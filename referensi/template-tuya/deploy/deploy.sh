#!/bin/bash
# Deploy Tuya MCP ke produksi - DENGAN PENGAMAN DATA (pola BYM).
# Dijalankan dari clone lokal SESUDAH commit di-push:  bash deploy/deploy.sh
#
#   1. cadangan DB - gagal = deploy DIBATALKAN;
#   2. hitung baris SETIAP tabel sebelum;
#   3. tarik kode, bangun image (penjaga ikut di dalam build);
#   4. migrasi ADITIF (tuya_migrasi) -> uji RLS -> nyalakan web + worker -> tunggu sehat;
#   5. hitung ulang - ada tabel yang BERKURANG = gagal + petunjuk pulih;
#   6. segarkan alat agen pemilik di AgentBuff (siapkan-tuya, tidak membatalkan rilis).
# Hanya menyentuh /opt/tuya dan kontainer tuya-*, plus menyimpan ulang produk tuya-mcp
# lewat rute admin AgentBuff (langkah 6). Layanan lain tidak disentuh.
set -euo pipefail

VPS=agentbuff-vps
AKAR=/opt/tuya
SHA=$(git rev-parse HEAD)
PENDEK=${SHA:0:7}

biru()  { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
gagal() { printf '\n\033[1;31mBATAL: %s\033[0m\n' "$*" >&2; exit 1; }
jauh()  { ssh -o BatchMode=yes "$VPS" "$@"; }

git fetch -q origin main
[ "$(git rev-parse origin/main)" = "$SHA" ] || gagal "commit $PENDEK belum di-push ke origin/main"

HITUNG_SQL="select string_agg(t || '|' || n, E'\n' order by t) from (select table_name as t, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint as n from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE') x"
hitung() {
  jauh "docker ps -q -f name=^tuya-db$ | grep -q . && docker exec tuya-db psql -U tuya_super -d tuya -t -A -c \"$HITUNG_SQL\" || true" | tr -d '\r' | sed '/^$/d'
}

biru "1/6 Cadangan dulu - deploy dibatalkan kalau gagal"
if jauh "docker ps -q -f name=^tuya-db$ | grep -q ."; then
  jauh "bash $AKAR/app/deploy/backup.sh" || gagal "cadangan gagal - tidak ada yang diubah di produksi"
else
  echo "    tuya-db belum berjalan (pemasangan pertama) - belum ada data untuk dicadangkan."
fi

biru "2/6 Hitung isi basis data sebelum deploy"
SEBELUM=$(hitung)
echo "${SEBELUM:-    (kosong)}" | sed 's/^/    /'

biru "3/6 Tarik kode $PENDEK & bangun image"
jauh "cd $AKAR/app && git fetch -q origin && git checkout -q --detach $SHA"
jauh "cd $AKAR/app && docker build -q -f deploy/Dockerfile --build-arg TUYA_VERSI=$PENDEK -t tuya:$PENDEK -t tuya:terbaru . > /dev/null" \
  || gagal "build image gagal (penjaga atau next build) - produksi tidak berubah"

biru "4/6 Migrasi aditif, uji isolasi, lalu nyalakan"
DC="cd $AKAR/app/deploy && TUYA_TAG=$PENDEK docker compose --env-file $AKAR/.env"
jauh "$DC up -d tuya-db && for i in \$(seq 1 30); do docker inspect -f '{{.State.Health.Status}}' tuya-db | grep -q healthy && break; sleep 2; done"
jauh "set -a; . $AKAR/.env; set +a; docker run --rm --network tuya_tuya_internal -e DATABASE_URL_MIGRASI=postgres://tuya_migrasi:\$TUYA_MIGRASI_PASSWORD@tuya-db:5432/tuya tuya:$PENDEK node dist/migrasi.mjs" \
  || gagal "migrasi gagal - web lama masih berjalan; periksa log di atas"
jauh "docker exec -i tuya-db psql -U tuya_super -d tuya -v ON_ERROR_STOP=1 -q < $AKAR/app/deploy/uji-rls.sql" || gagal "UJI ISOLASI DATA (RLS) GAGAL - web lama masih berjalan"
jauh "$DC up -d tuya-web tuya-worker"
for i in $(seq 1 40); do
  if jauh "docker exec tuya-web wget -qO- http://127.0.0.1:3000/api/health" 2>/dev/null | grep -q '"ok":true'; then
    echo "    sehat."
    break
  fi
  [ "$i" = "40" ] && gagal "tuya-web tidak sehat - lihat: docker logs tuya-web (cadangan: /var/lib/tuya/backups/harian)"
  sleep 3
done

biru "5/6 Pastikan tidak ada data yang hilang"
SESUDAH=$(hitung)
MENYUSUT=0
while IFS='|' read -r tabel lama; do
  [ -z "${tabel:-}" ] && continue
  # Tabel yang memang dipangkas berkala (riwayat 90 hari, jti, sesi kedaluwarsa) boleh berkurang.
  # foto_kamera: kedaluwarsa 7 hari dihapus worker, berkurang saat deploy itu wajar.
  case "$tabel" in aktivitas|jti_terpakai|sesi|foto_kamera) continue ;; esac
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
  printf 'Periksa dulu apakah ada pengguna yang menghapus data tepat saat deploy (aktivitas).\n'
  printf 'Bila deploy yang merusak: pulihkan dari cadangan terbaru di %s:/var/lib/tuya/backups/harian\n' "$VPS"
  exit 1
fi
printf '\n\033[1;32mDeploy %s selesai. Tidak ada data yang berkurang.\033[0m\n' "$PENDEK"

# Agen pemilik menyimpan daftar alat MCP di memori sejak tersambung: alat baru atau
# panduan baru baru terlihat sesudah produk di AgentBuff disimpan ulang (menyebarkan
# pemasangan ulang + muat ulang alat ke tiap pemilik). Idempoten; status produk
# tidak berubah. Gagal di sini TIDAK membatalkan rilis (data sudah aman di atas).
biru "6/6 Segarkan alat agen pemilik di AgentBuff"
if jauh "cd /root/agentbuff && AGENTBUFF_WORKERS_DISABLED=true timeout 300 ./node_modules/.bin/tsx --env-file=.env.local scripts/siapkan-tuya.ts --basis https://agentbuff.id"; then
  echo "    disebarkan (pemasangan ulang berjalan di latar, 1-2 menit)."
else
  printf '\033[1;33m    PERINGATAN: penyegaran gagal. Agen pemilik belum melihat alat terbaru sampai ini dijalankan:\n    ssh %s "cd /root/agentbuff && ./node_modules/.bin/tsx --env-file=.env.local scripts/siapkan-tuya.ts --basis https://agentbuff.id"\033[0m\n' "$VPS"
fi
