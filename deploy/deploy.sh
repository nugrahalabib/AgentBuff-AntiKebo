#!/bin/bash
# Deploy AntiKebo ke produksi DENGAN PENGAMAN DATA (pola template Tuya / BYM).
# Dijalankan dari clone di laptop Chief SESUDAH commit di-push ke main:  bash deploy/deploy.sh
# Tidak pernah dijalankan dari sesi cloud (CLAUDE.md §6).
#
#   1. cadangan DB: gagal = deploy DIBATALKAN;
#   2. hitung baris SETIAP tabel sebelum;
#   3. tarik kode, bangun image (penjaga ikut di dalam build);
#   4. migrasi ADITIF (antikebo_migrasi), uji RLS, nyalakan web + worker, tunggu sehat;
#   5. hitung ulang: ada tabel yang BERKURANG = gagal + petunjuk pulih;
#   6. segarkan alat agen pemilik di AgentBuff (opsional, tidak membatalkan rilis).
#
# Lokasi server tidak ditulis di repo publik. Isi deploy/.env.deploy (diabaikan git):
#   ANTIKEBO_VPS=<alias ssh>                 wajib
#   ANTIKEBO_AKAR=/opt/antikebo              opsional
#   ANTIKEBO_CADANGAN=/var/lib/antikebo/backups   opsional
#   ANTIKEBO_PERINTAH_SEGARKAN="<perintah jauh>"  opsional, langkah 6
set -euo pipefail

DIR_INI="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
[ -f "$DIR_INI/.env.deploy" ] && . "$DIR_INI/.env.deploy"
VPS=${ANTIKEBO_VPS:?isi ANTIKEBO_VPS di deploy/.env.deploy}
AKAR=${ANTIKEBO_AKAR:-/opt/antikebo}
CADANGAN=${ANTIKEBO_CADANGAN:-/var/lib/antikebo/backups}
SHA=$(git rev-parse HEAD)
PENDEK=${SHA:0:7}

biru()  { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
gagal() { printf '\n\033[1;31mBATAL: %s\033[0m\n' "$*" >&2; exit 1; }
jauh()  { ssh -o BatchMode=yes "$VPS" "$@"; }

git fetch -q origin main
[ "$(git rev-parse origin/main)" = "$SHA" ] || gagal "commit $PENDEK belum di-push ke origin/main"

HITUNG_SQL="select string_agg(t || '|' || n, E'\n' order by t) from (select table_name as t, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint as n from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE') x"
hitung() {
  jauh "docker ps -q -f name=^antikebo-db$ | grep -q . && docker exec antikebo-db psql -U antikebo_super -d antikebo -t -A -c \"$HITUNG_SQL\" || true" | tr -d '\r' | sed '/^$/d'
}

biru "1/6 Cadangan dulu: deploy dibatalkan kalau gagal"
if jauh "docker ps -q -f name=^antikebo-db$ | grep -q ."; then
  jauh "ANTIKEBO_AKAR=$AKAR ANTIKEBO_CADANGAN=$CADANGAN bash $AKAR/app/deploy/backup.sh" || gagal "cadangan gagal: tidak ada yang diubah di produksi"
else
  echo "    antikebo-db belum berjalan (pemasangan pertama): belum ada data untuk dicadangkan."
fi

biru "2/6 Hitung isi basis data sebelum deploy"
SEBELUM=$(hitung)
echo "${SEBELUM:-    (kosong)}" | sed 's/^/    /'

biru "3/6 Tarik kode $PENDEK & bangun image"
jauh "cd $AKAR/app && git fetch -q origin && git checkout -q --detach $SHA"
jauh "cd $AKAR/app && docker build -q -f deploy/Dockerfile --build-arg ANTIKEBO_VERSI=$PENDEK -t antikebo:$PENDEK -t antikebo:terbaru . > /dev/null" \
  || gagal "build image gagal (penjaga atau next build): produksi tidak berubah"

biru "4/6 Migrasi aditif, uji isolasi, lalu nyalakan"
DC="cd $AKAR/app/deploy && ANTIKEBO_AKAR=$AKAR ANTIKEBO_TAG=$PENDEK docker compose --env-file $AKAR/.env"
jauh "$DC up -d antikebo-db && for i in \$(seq 1 30); do docker inspect -f '{{.State.Health.Status}}' antikebo-db | grep -q healthy && break; sleep 2; done"
jauh "set -a; . $AKAR/.env; set +a; docker run --rm --network antikebo_antikebo_internal -e DATABASE_URL_MIGRASI=postgres://antikebo_migrasi:\$ANTIKEBO_MIGRASI_PASSWORD@antikebo-db:5432/antikebo antikebo:$PENDEK node dist/migrasi.mjs" \
  || gagal "migrasi gagal: web lama masih berjalan; periksa log di atas"
jauh "docker exec -i antikebo-db psql -U antikebo_super -d antikebo -v ON_ERROR_STOP=1 -q < $AKAR/app/deploy/uji-rls.sql" || gagal "UJI ISOLASI DATA (RLS) GAGAL: web lama masih berjalan"
jauh "$DC up -d antikebo-web antikebo-worker"
for i in $(seq 1 40); do
  if jauh "docker exec antikebo-web wget -qO- http://127.0.0.1:3000/api/health" 2>/dev/null | grep -q '"ok":true'; then
    echo "    sehat."
    break
  fi
  [ "$i" = "40" ] && gagal "antikebo-web tidak sehat: lihat docker logs antikebo-web (cadangan: $CADANGAN/harian)"
  sleep 3
done

biru "5/6 Pastikan tidak ada data yang hilang"
SESUDAH=$(hitung)
MENYUSUT=0
while IFS='|' read -r tabel lama; do
  [ -z "${tabel:-}" ] && continue
  # Tabel yang memang dipangkas berkala (audit 90 hari, jti, sesi kedaluwarsa) boleh berkurang.
  case "$tabel" in audit|jti_terpakai|sesi) continue ;; esac
  baru=$(grep "^$tabel|" <<<"$SESUDAH" | cut -d'|' -f2 || true)
  if [ -z "$baru" ] || [ "$baru" -lt "$lama" ]; then
    printf '\033[1;31m    BERKURANG  %-24s %s -> %s\033[0m\n' "$tabel" "$lama" "${baru:-hilang}"
    MENYUSUT=1
  else
    printf '    aman       %-24s %s\n' "$tabel" "$baru"
  fi
done <<<"$SEBELUM"

if [ "$MENYUSUT" = "1" ]; then
  printf '\n\033[1;31m!! ISI TABEL BERKURANG SELAMA DEPLOY !!\033[0m\n'
  printf 'Periksa dulu apakah ada pengguna yang menghapus data tepat saat deploy (audit).\n'
  printf 'Bila deploy yang merusak: pulihkan dari cadangan terbaru di %s:%s/harian\n' "$VPS" "$CADANGAN"
  exit 1
fi
printf '\n\033[1;32mDeploy %s selesai. Tidak ada data yang berkurang.\033[0m\n' "$PENDEK"

# Agen pemilik menyimpan daftar alat MCP sejak tersambung: alat baru baru terlihat sesudah
# produk di AgentBuff disimpan ulang. Gagal di sini TIDAK membatalkan rilis.
biru "6/6 Segarkan alat agen pemilik di AgentBuff"
if [ -z "${ANTIKEBO_PERINTAH_SEGARKAN:-}" ]; then
  echo "    dilewati (ANTIKEBO_PERINTAH_SEGARKAN kosong)."
elif jauh "$ANTIKEBO_PERINTAH_SEGARKAN"; then
  echo "    disebarkan (pemasangan ulang berjalan di latar, 1-2 menit)."
else
  printf '\033[1;33m    PERINGATAN: penyegaran gagal. Agen pemilik belum melihat alat terbaru sampai perintah itu dijalankan ulang.\033[0m\n'
fi
