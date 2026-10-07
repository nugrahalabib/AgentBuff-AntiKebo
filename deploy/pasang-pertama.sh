#!/bin/bash
# Pemasangan PERTAMA AntiKebo di VPS: dijalankan sekali sebagai root di VPS sesudah repo
# di-clone ke <ANTIKEBO_AKAR>/app:
#   ANTIKEBO_RAHASIA_MASUK=<berkas klien OIDC> bash <ANTIKEBO_AKAR>/app/deploy/pasang-pertama.sh
# Idempoten: aman diulang; tidak pernah menimpa .env atau data yang sudah ada.
# Tidak menyentuh layanan lain di VPS.
set -euo pipefail

AKAR=${ANTIKEBO_AKAR:-/opt/antikebo}
CADANGAN=${ANTIKEBO_CADANGAN:-/var/lib/antikebo/backups}
ENV=$AKAR/.env
RAHASIA_MASUK=${ANTIKEBO_RAHASIA_MASUK:-}

mkdir -p "$AKAR/data/pg" "$CADANGAN/harian"
chmod 700 "$CADANGAN"

acak() { openssl rand -hex "$1"; }

if [ ! -f "$ENV" ]; then
  [ -n "$RAHASIA_MASUK" ] && [ -f "$RAHASIA_MASUK" ] || { echo "BATAL: ANTIKEBO_RAHASIA_MASUK belum menunjuk berkas klien OIDC antikebo (daftarkan klien dulu)"; exit 1; }
  umask 077
  {
    echo "APP_ORIGIN=https://antikebo.agentbuff.id"
    echo "AGENTBUFF_ISSUER=https://agentbuff.id/masuk"
    echo "AGENTBUFF_ORIGIN=https://agentbuff.id"
    echo "AGENTBUFF_PRODUCT_KEY=antikebo"
    grep -E '^AGENTBUFF_MASUK_CLIENT_(ID|SECRET)=' "$RAHASIA_MASUK"
    echo "SESSION_SECRET=$(acak 32)"
    echo "ENCRYPTION_KEK=$(openssl rand -base64 32)"
    echo "ANTIKEBO_SUPER_PASSWORD=$(acak 24)"
    echo "ANTIKEBO_MIGRASI_PASSWORD=$(acak 24)"
    echo "ANTIKEBO_APP_PASSWORD=$(acak 24)"
    echo "ANTIKEBO_WORKER_PASSWORD=$(acak 24)"
    echo "LOG_LEVEL=info"
  } > "$ENV"
  chmod 600 "$ENV"
  echo "  .env dibuat (nilai rahasia tidak dicetak). PC_UPDATE_PUBKEY ditambahkan saat P10 dirilis."
else
  echo "  .env sudah ada: dibiarkan."
fi

# Kunci VAPID notifikasi web (wajib sejak P6): ditambahkan sekali bila belum ada, tidak pernah
# diganti (mengganti kunci = semua langganan notifikasi pengguna putus). Kunci P-256 dari SEC1 DER:
# rahasia = 32 bait mulai bait ke-8, publik = 65 bait terakhir; keduanya base64url.
if ! grep -q '^VAPID_PUBLIC_KEY=.' "$ENV"; then
  b64url() { base64 -w0 | tr '+/' '-_' | tr -d '='; }
  KUNCI=$(mktemp)
  openssl ecparam -name prime256v1 -genkey -noout -outform DER 2>/dev/null | openssl ec -inform DER -outform DER -out "$KUNCI" 2>/dev/null
  {
    echo "VAPID_PUBLIC_KEY=$(tail -c 65 "$KUNCI" | b64url)"
    echo "VAPID_PRIVATE_KEY=$(head -c 39 "$KUNCI" | tail -c 32 | b64url)"
    echo "VAPID_SUBJECT=mailto:operator@agentbuff.id"
  } >> "$ENV"
  rm -f "$KUNCI"
  chmod 600 "$ENV"
  echo "  kunci VAPID ditambahkan ke .env (tidak dicetak)."
fi

# Cadangan tiap 6 jam (baris ditambah hanya bila belum ada).
TAB=$(crontab -l 2>/dev/null || true)
tambah() { grep -qF "$2" <<<"$TAB" || TAB="$TAB"$'\n'"$1 # $2"; }
tambah "35 */6 * * * ANTIKEBO_AKAR=$AKAR ANTIKEBO_CADANGAN=$CADANGAN bash $AKAR/app/deploy/backup.sh >> $CADANGAN/backup.log 2>&1" "cadangan DB AntiKebo tiap 6 jam"
printf '%s\n' "$TAB" | sed '/^$/d' | crontab -
echo "  cron cadangan terpasang."
