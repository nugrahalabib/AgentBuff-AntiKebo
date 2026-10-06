#!/bin/bash
# Pemasangan PERTAMA Tuya MCP di VPS - dijalankan sekali sebagai root di VPS:
#   bash /opt/tuya/app/deploy/pasang-pertama.sh
# Idempoten: aman diulang; tidak pernah menimpa .env atau data yang sudah ada.
# Tidak menyentuh layanan lain (AgentBuff, BYM, Kasir POS, KostCloud, Absentra, n8n).
set -euo pipefail

AKAR=/opt/tuya
ENV=$AKAR/.env
RAHASIA_MASUK=/root/masuk-rahasia/tuya.env

mkdir -p "$AKAR/data/pg" /var/lib/tuya/backups/harian
chmod 700 /var/lib/tuya/backups

acak() { openssl rand -hex "$1"; }

if [ ! -f "$ENV" ]; then
  [ -f "$RAHASIA_MASUK" ] || { echo "BATAL: $RAHASIA_MASUK belum ada (daftarkan klien OIDC tuya dulu)"; exit 1; }
  umask 077
  {
    echo "APP_ORIGIN=https://tuya.agentbuff.id"
    echo "AGENTBUFF_ISSUER=https://agentbuff.id/masuk"
    echo "AGENTBUFF_ORIGIN=https://agentbuff.id"
    echo "AGENTBUFF_PRODUCT_KEY=tuya-mcp"
    grep -E '^AGENTBUFF_MASUK_CLIENT_(ID|SECRET)=' "$RAHASIA_MASUK"
    echo "SESSION_SECRET=$(acak 32)"
    echo "ENCRYPTION_KEK=$(openssl rand -base64 32)"
    echo "TUYA_SUPER_PASSWORD=$(acak 24)"
    echo "TUYA_MIGRASI_PASSWORD=$(acak 24)"
    echo "TUYA_APP_PASSWORD=$(acak 24)"
    echo "TUYA_WORKER_PASSWORD=$(acak 24)"
    echo "LOG_LEVEL=info"
  } > "$ENV"
  chmod 600 "$ENV"
  echo "  .env dibuat (nilai rahasia tidak dicetak)."
else
  echo "  .env sudah ada - dibiarkan."
fi

# Cadangan tiap 6 jam (baris ditambah hanya bila belum ada).
TAB=$(crontab -l 2>/dev/null || true)
tambah() { grep -qF "$2" <<<"$TAB" || TAB="$TAB"$'\n'"$1 # $2"; }
tambah "35 */6 * * * bash $AKAR/app/deploy/backup.sh >> /var/lib/tuya/backups/backup.log 2>&1" "cadangan DB Tuya MCP tiap 6 jam"
printf '%s\n' "$TAB" | sed '/^$/d' | crontab -
echo "  cron cadangan terpasang."
