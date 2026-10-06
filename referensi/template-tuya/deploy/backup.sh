#!/bin/bash
# Cadangan Tuya MCP: pg_dump tiap 6 jam (simpan 14 hari) + salinan .env harian
# (ENCRYPTION_KEK membuka kunci Tuya di dump - tanpa .env dump setengah berguna).
# Diverifikasi 3 lapis: gzip utuh, ukuran > 0, baris penutup "dump complete".
set -euo pipefail

DIR=/var/lib/tuya/backups/harian
AKAR=/opt/tuya
mkdir -p "$DIR"
chmod 700 /var/lib/tuya/backups
T=$(date -u +%Y%m%d-%H%M%S)
F="$DIR/tuya-db-$T.sql.gz"

# Isi foto_kamera (salinan foto CCTV 7 hari) tidak ikut: besar, sementara, dan pribadi.
docker exec tuya-db pg_dump -U tuya_super -d tuya --exclude-table-data=foto_kamera | gzip -9 > "$F.tmp"
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

if [ ! -f "$DIR/tuya-env-$(date -u +%Y%m%d).env" ]; then
  install -m 600 "$AKAR/.env" "$DIR/tuya-env-$(date -u +%Y%m%d).env"
fi

find "$DIR" -type f -mtime +14 -delete
echo "$T ok $(du -h "$F" | cut -f1)"
