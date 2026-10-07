#!/bin/bash
# Cadangan AntiKebo: pg_dump (dijadwalkan cron tiap 6 jam, simpan 14 hari) + salinan .env harian
# (ENCRYPTION_KEK membuka rahasia di dump: tanpa .env dump setengah berguna).
# Diverifikasi 3 lapis: gzip utuh, ukuran > 0, baris penutup "dump complete".
# Klip suara (bytea) ikut dicadangkan supaya alarm tidak kehilangan omelan sesudah pulih.
set -euo pipefail

AKAR=${ANTIKEBO_AKAR:-/opt/antikebo}
DIR=${ANTIKEBO_CADANGAN:-/var/lib/antikebo/backups}/harian
mkdir -p "$DIR"
chmod 700 "$(dirname "$DIR")"
T=$(date -u +%Y%m%d-%H%M%S)
F="$DIR/antikebo-db-$T.sql.gz"

docker exec antikebo-db pg_dump -U antikebo_super -d antikebo | gzip -9 > "$F.tmp"
gzip -t "$F.tmp"
[ -s "$F.tmp" ] || { echo "$T GAGAL: dump kosong"; rm -f "$F.tmp"; exit 1; }
# Ekor ditampung dulu: `zcat | tail | grep -q` + pipefail = gagal palsu (SIGPIPE).
EKOR=$(zcat "$F.tmp" | tail -n 20)
if ! grep -q "PostgreSQL database dump complete" <<<"$EKOR"; then
  echo "$T GAGAL: dump terpotong"
  rm -f "$F.tmp"
  exit 1
fi
mv "$F.tmp" "$F"
chmod 600 "$F"

if [ ! -f "$DIR/antikebo-env-$(date -u +%Y%m%d).env" ]; then
  install -m 600 "$AKAR/.env" "$DIR/antikebo-env-$(date -u +%Y%m%d).env"
fi

find "$DIR" -type f -mtime +14 -delete
echo "$T ok $(du -h "$F" | cut -f1)"
