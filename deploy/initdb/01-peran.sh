#!/bin/sh
# Peran basis data AntiKebo: dijalankan SEKALI saat direktori data Postgres baru
# diinisialisasi. Tidak ada peran aplikasi yang superuser atau BYPASSRLS; pemilik
# tabel (antikebo_migrasi) pun terkena RLS lewat FORCE.
# Pengembangan & CI memakai scripts/siapkan-lokal.sh (isi sama, idempoten).
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE EXTENSION IF NOT EXISTS citext;
CREATE ROLE antikebo_migrasi LOGIN PASSWORD '${ANTIKEBO_MIGRASI_PASSWORD}' NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
CREATE ROLE antikebo_app LOGIN PASSWORD '${ANTIKEBO_APP_PASSWORD}' NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
CREATE ROLE antikebo_worker LOGIN PASSWORD '${ANTIKEBO_WORKER_PASSWORD}' NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
GRANT CONNECT, CREATE ON DATABASE ${POSTGRES_DB} TO antikebo_migrasi;
GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO antikebo_app, antikebo_worker;
ALTER SCHEMA public OWNER TO antikebo_migrasi;
GRANT USAGE ON SCHEMA public TO antikebo_app, antikebo_worker;
ALTER DEFAULT PRIVILEGES FOR ROLE antikebo_migrasi IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO antikebo_app, antikebo_worker;
ALTER DEFAULT PRIVILEGES FOR ROLE antikebo_migrasi IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO antikebo_app, antikebo_worker;
ALTER DEFAULT PRIVILEGES FOR ROLE antikebo_migrasi IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO antikebo_app, antikebo_worker;
SQL
