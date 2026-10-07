#!/usr/bin/env bash
# Siapkan mesin pengembang / sesi cloud / CI (idempoten, aman diulang):
#   1. .env.local berisi nilai acak + server tiruan AgentBuff (bila belum ada; tidak pernah ditimpa);
#   2. peran DB tanpa BYPASSRLS (antikebo_migrasi, antikebo_app, antikebo_worker) + DB antikebo;
#   3. migrasi aditif sebagai antikebo_migrasi.
# Superuser Postgres: PSQL_SUPER (mis. "psql -h 127.0.0.1 -U postgres" di CI), bawaan
# `runuser -u postgres -- psql` bila dijalankan root, selain itu `psql`. Nilai rahasia tidak dicetak.
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_LOKAL=.env.local
DB=${ANTIKEBO_DB:-antikebo}
acak() { openssl rand -hex "$1"; }

if [ ! -f "$ENV_LOKAL" ]; then
  umask 077
  MIG=$(acak 16)
  APP=$(acak 16)
  WRK=$(acak 16)
  cat > "$ENV_LOKAL" <<EOT
# Dibuat scripts/siapkan-lokal.sh. Hanya untuk mesin ini; jangan di-commit.
DATABASE_URL=postgres://antikebo_app:$APP@127.0.0.1:5432/$DB
DATABASE_URL_MIGRASI=postgres://antikebo_migrasi:$MIG@127.0.0.1:5432/$DB
DATABASE_URL_WORKER=postgres://antikebo_worker:$WRK@127.0.0.1:5432/$DB
APP_ORIGIN=http://localhost:3100
SESSION_SECRET=$(acak 32)
ENCRYPTION_KEK=$(openssl rand -base64 32)
AGENTBUFF_ISSUER=http://127.0.0.1:3199/masuk
AGENTBUFF_ORIGIN=http://127.0.0.1:3199
AGENTBUFF_PRODUCT_KEY=antikebo
AGENTBUFF_MASUK_CLIENT_ID=antikebo-dev
AGENTBUFF_MASUK_CLIENT_SECRET=$(acak 24)
AGENTBUFF_TIRUAN=1
AGENTBUFF_TIRUAN_URL=http://127.0.0.1:3199/masuk
LOG_LEVEL=info
ANTIKEBO_MIGRASI_PASSWORD=$MIG
ANTIKEBO_APP_PASSWORD=$APP
ANTIKEBO_WORKER_PASSWORD=$WRK
EOT
  echo "siapkan-lokal: .env.local dibuat (nilai acak, tidak dicetak)"
fi

# Kunci VAPID notifikasi web (P6): ditambahkan ke .env.local lama yang belum punya (tidak menimpa).
if ! grep -q '^VAPID_PUBLIC_KEY=.' "$ENV_LOKAL"; then
  node -e '
    const { generateKeyPairSync } = require("node:crypto");
    const j = generateKeyPairSync("ec", { namedCurve: "prime256v1" }).privateKey.export({ format: "jwk" });
    const pub = Buffer.concat([Buffer.from([4]), Buffer.from(j.x, "base64url"), Buffer.from(j.y, "base64url")]).toString("base64url");
    process.stdout.write(`VAPID_PUBLIC_KEY=${pub}\nVAPID_PRIVATE_KEY=${j.d}\nVAPID_SUBJECT=mailto:pengembang@antikebo.invalid\n`);
  ' >> "$ENV_LOKAL"
  echo "siapkan-lokal: kunci VAPID ditambahkan ke .env.local (tidak dicetak)"
fi

set -a
# shellcheck disable=SC1090
. "./$ENV_LOKAL"
set +a

if [ -n "${PSQL_SUPER:-}" ]; then
  read -r -a PSQL <<<"$PSQL_SUPER"
elif [ "$(id -u)" = "0" ] && command -v runuser >/dev/null 2>&1; then
  PSQL=(runuser -u postgres -- psql)
else
  PSQL=(psql)
fi

# Kata sandi berupa heksadesimal acak, aman disisipkan ke SQL.
"${PSQL[@]}" -v ON_ERROR_STOP=1 -q -d postgres <<SQL >/dev/null
SELECT 'CREATE ROLE antikebo_migrasi' WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'antikebo_migrasi')\gexec
SELECT 'CREATE ROLE antikebo_app' WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'antikebo_app')\gexec
SELECT 'CREATE ROLE antikebo_worker' WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'antikebo_worker')\gexec
ALTER ROLE antikebo_migrasi LOGIN PASSWORD '${ANTIKEBO_MIGRASI_PASSWORD}' NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
ALTER ROLE antikebo_app LOGIN PASSWORD '${ANTIKEBO_APP_PASSWORD}' NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
ALTER ROLE antikebo_worker LOGIN PASSWORD '${ANTIKEBO_WORKER_PASSWORD}' NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
SELECT 'CREATE DATABASE ${DB}' WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '${DB}')\gexec
SQL

# Sama dengan deploy/initdb/01-peran.sh (produksi).
"${PSQL[@]}" -v ON_ERROR_STOP=1 -q -d "$DB" <<SQL >/dev/null
SET client_min_messages = warning;
CREATE EXTENSION IF NOT EXISTS citext;
GRANT CONNECT, CREATE ON DATABASE ${DB} TO antikebo_migrasi;
GRANT CONNECT ON DATABASE ${DB} TO antikebo_app, antikebo_worker;
ALTER SCHEMA public OWNER TO antikebo_migrasi;
GRANT USAGE ON SCHEMA public TO antikebo_app, antikebo_worker;
ALTER DEFAULT PRIVILEGES FOR ROLE antikebo_migrasi IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO antikebo_app, antikebo_worker;
ALTER DEFAULT PRIVILEGES FOR ROLE antikebo_migrasi IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO antikebo_app, antikebo_worker;
ALTER DEFAULT PRIVILEGES FOR ROLE antikebo_migrasi IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO antikebo_app, antikebo_worker;
SQL
echo "siapkan-lokal: peran dan basis data '$DB' siap"

pnpm --silent db:migrate
