#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)

if [ -z "${TM_SMOKE_BASE_URL:-}" ] && [ -z "${FRONTEND_DOMAIN:-}" ] && [ -f "$ROOT_DIR/.env" ]; then
  FRONTEND_DOMAIN=$(
    grep -E '^FRONTEND_DOMAIN=' "$ROOT_DIR/.env" \
      | tail -n 1 \
      | cut -d= -f2- \
      | tr -d '\r' \
      | sed "s/^'//;s/'$//;s/^\"//;s/\"$//"
  )
  export FRONTEND_DOMAIN
fi

exec node "$ROOT_DIR/scripts/smoke-services-browser-session.mjs" "$@"
