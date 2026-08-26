#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)

resolve_auth_action() {
  if [ -n "${TM_SMOKE_COOKIE:-}" ]; then
    printf 'run\n'
    return
  fi
  if [ -z "${TM_SMOKE_USERNAME:-}" ] && [ -z "${TM_SMOKE_PASSWORD:-}" ]; then
    printf 'rotate\n'
    return
  fi
  if [ -z "${TM_SMOKE_USERNAME:-}" ] || [ -z "${TM_SMOKE_PASSWORD:-}" ]; then
    echo "TM_SMOKE_USERNAME과 TM_SMOKE_PASSWORD를 함께 지정해야 합니다" >&2
    return 1
  fi
  printf 'run\n'
}

run_wrapper_self_test() {
  [ "$(TM_SMOKE_COOKIE='' TM_SMOKE_USERNAME='' TM_SMOKE_PASSWORD='' resolve_auth_action)" = "rotate" ]
  [ "$(TM_SMOKE_COOKIE="session=test" resolve_auth_action)" = "run" ]
  [ "$(TM_SMOKE_COOKIE='' TM_SMOKE_USERNAME="viewer" TM_SMOKE_PASSWORD="password" resolve_auth_action)" = "run" ]
  if TM_SMOKE_COOKIE='' TM_SMOKE_USERNAME="viewer" TM_SMOKE_PASSWORD='' \
    resolve_auth_action >/dev/null 2>&1; then
    echo "불완전한 로그인 인증값을 허용했습니다" >&2
    return 1
  fi
  echo "서비스 스모크 자격증명 전달 self-test 통과"
}

if [ "${1:-}" = "--self-test" ]; then
  run_wrapper_self_test
  exec node "$ROOT_DIR/scripts/smoke-services-browser-session.mjs" --self-test
fi

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

auth_action="$(resolve_auth_action)" || exit $?
if [ "${auth_action}" = "rotate" ]; then
  exec "$ROOT_DIR/scripts/rotate-smoke-viewer-password.sh"
fi

exec node "$ROOT_DIR/scripts/smoke-services-browser-session.mjs" "$@"
