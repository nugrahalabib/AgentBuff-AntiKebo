#!/usr/bin/env bash
# Persiapan otomatis sesi Claude di cloud (dipanggil hook SessionStart di .claude/settings.json).
# Di laptop Chief skrip ini tidak melakukan apa-apa. Urutan: Postgres, dependensi,
# .env.local + peran + DB + migrasi (scripts/siapkan-lokal.sh), Rust bila ada pc/.
# Keluaran singkat; log lengkap di /tmp/sesi-cloud-*.log. Tidak pernah mencetak rahasia.
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

if [ ! -f package.json ]; then
  echo "sesi-cloud: belum ada package.json"
  exit 0
fi

corepack enable >/dev/null 2>&1 || true
if pnpm install --frozen-lockfile >/tmp/sesi-cloud-install.log 2>&1; then
  echo "sesi-cloud: dependensi terpasang"
else
  echo "sesi-cloud: pnpm install gagal, lihat /tmp/sesi-cloud-install.log"
  exit 0
fi

if bash scripts/siapkan-lokal.sh >/tmp/sesi-cloud-db.log 2>&1; then
  echo "sesi-cloud: .env.local, peran DB, dan migrasi siap (server tiruan: pnpm tiruan)"
else
  echo "sesi-cloud: persiapan DB gagal, lihat /tmp/sesi-cloud-db.log"
fi

# Aplikasi PC (P10): logika di crate pc/inti, diuji di Linux tanpa pustaka Tauri.
if [ -f pc/Cargo.toml ] && command -v cargo >/dev/null 2>&1; then
  if (cd pc && cargo fetch >/tmp/sesi-cloud-cargo.log 2>&1); then
    echo "sesi-cloud: crate Rust terunduh"
  else
    echo "sesi-cloud: cargo fetch gagal, lihat /tmp/sesi-cloud-cargo.log"
  fi
fi

exit 0
