#!/usr/bin/env bash
# Persiapan otomatis sesi Claude di cloud (dipanggil hook SessionStart di .claude/settings.json).
# Di laptop Chief skrip ini tidak melakukan apa-apa.
# Paket kerja P0 melengkapi skrip ini: peran dan database pengembangan, migrasi, .env.local acak.
set -uo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/..}" || exit 0

if command -v service >/dev/null 2>&1; then
  if service postgresql start >/dev/null 2>&1; then
    echo "sesi-cloud: Postgres menyala"
  else
    echo "sesi-cloud: Postgres gagal dinyalakan (cek 'service postgresql status')"
  fi
fi

if [ -f package.json ]; then
  corepack enable >/dev/null 2>&1 || true
  if pnpm install --frozen-lockfile >/tmp/sesi-cloud-install.log 2>&1; then
    echo "sesi-cloud: dependensi terpasang"
  else
    echo "sesi-cloud: pnpm install gagal, lihat /tmp/sesi-cloud-install.log"
  fi
else
  echo "sesi-cloud: belum ada package.json (paket P0 belum dikerjakan)"
fi

exit 0
