#!/bin/bash
# SessionStart hook — prepares a Claude Code on the web session so lint,
# typecheck, build and the structured-data gate all work out of the box:
# installs deps and brings up the local Postgres the app expects.
set -uo pipefail

# Only run in the remote (web) environment.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR" || exit 0

echo "[session-start] installing dependencies…"
pnpm install --prefer-offline || pnpm install

# Local env file (DATABASE_URL etc.) — matches docker-compose / cluster defaults.
[ -f .env ] || cp .env.example .env

# Bring up Postgres. Prefer docker compose; fall back to the local PG16 cluster.
if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
  echo "[session-start] starting Postgres…"
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    docker compose up -d >/dev/null 2>&1 || true
  fi
  if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
    sudo pg_ctlcluster 16 main start >/dev/null 2>&1 \
      || sudo service postgresql start >/dev/null 2>&1 || true
  fi
  for _ in $(seq 1 15); do
    pg_isready -h localhost -p 5432 >/dev/null 2>&1 && break
    sleep 1
  done
fi

# Ensure the role + database exist, then migrate + seed (all idempotent).
if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
  if command -v sudo >/dev/null 2>&1 && sudo -n -u postgres psql -tc "SELECT 1" >/dev/null 2>&1; then
    sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='hantslocal'" 2>/dev/null | grep -q 1 \
      || sudo -u postgres psql -c "CREATE ROLE hantslocal LOGIN PASSWORD 'hantslocal'" >/dev/null 2>&1 || true
    sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='hantslocal'" 2>/dev/null | grep -q 1 \
      || sudo -u postgres createdb -O hantslocal hantslocal >/dev/null 2>&1 || true
  fi
  echo "[session-start] applying migrations + seed…"
  pnpm db:migrate || true
  pnpm db:seed || true
else
  echo "[session-start] Postgres unavailable — skipped migrate/seed (lint/typecheck still work)."
fi

echo "[session-start] ready."
