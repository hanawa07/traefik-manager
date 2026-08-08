#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)

if [ -z "${TM_SMOKE_BASE_URL:-}" ] && [ -f "$ROOT_DIR/.env" ]; then
  TM_SMOKE_BASE_URL=$(
    grep -E '^(TAILNET_FRONTEND_URL|FRONTEND_DOMAIN)=' "$ROOT_DIR/.env" \
      | awk -F= '$1 == "TAILNET_FRONTEND_URL" && length($2) {print; found=1; exit} !fallback && $1 == "FRONTEND_DOMAIN" {fallback=$0} END {if (!found && fallback) print fallback}' \
      | tail -n 1 \
      | cut -d= -f2- \
      | tr -d '\r' \
      | sed "s/^'//;s/'$//;s/^\"//;s/\"$//"
  )
  export TM_SMOKE_BASE_URL
fi

exec node "$ROOT_DIR/scripts/smoke-services-browser-session.mjs" "$@"
