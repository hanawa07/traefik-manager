#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_PATH="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/$(basename -- "${BASH_SOURCE[0]}")"
readonly GH_BIN="${TM_HOST_OPERATION_ALERT_GH_BIN:-gh}"
readonly REPOSITORY="${TM_HOST_OPERATION_ALERT_REPOSITORY:-hanawa07/traefik-manager}"
readonly DRY_RUN="${TM_HOST_OPERATION_ALERT_DRY_RUN:-false}"

validate_input() {
  local status="$1"
  local dry_run="$2"
  [[ "${status}" == "failure" || "${status}" == "recovery" ]] \
    || { echo "알림 상태는 failure 또는 recovery여야 합니다" >&2; return 1; }
  [[ "${dry_run}" == "true" || "${dry_run}" == "false" ]] \
    || { echo "dry-run 값은 true 또는 false여야 합니다" >&2; return 1; }
}

run_self_test() {
  local temporary_dir fake_gh capture_file
  temporary_dir="$(mktemp -d)"
  trap 'rm -rf "${temporary_dir}"' RETURN
  fake_gh="${temporary_dir}/gh"
  capture_file="${temporary_dir}/arguments"
  cat > "${fake_gh}" <<'SCRIPT'
#!/usr/bin/env bash
printf '%s\n' "$@" > "${TM_HOST_OPERATION_ALERT_CAPTURE}"
SCRIPT
  chmod 700 "${fake_gh}"
  TM_HOST_OPERATION_ALERT_GH_BIN="${fake_gh}" \
  TM_HOST_OPERATION_ALERT_DRY_RUN=true \
  TM_HOST_OPERATION_ALERT_CAPTURE="${capture_file}" \
    "${SCRIPT_PATH}" "blue-green rollback" "복원 실패" failure
  grep -Fxq 'source=blue-green rollback' "${capture_file}"
  grep -Fxq 'detail=복원 실패' "${capture_file}"
  grep -Fxq 'status=failure' "${capture_file}"
  grep -Fxq 'dry_run=true' "${capture_file}"
  echo "호스트 운영 알림 요청 self-test 통과"
}

if [[ "${1:-}" == "--self-test" ]]; then
  run_self_test
  exit 0
fi

source_name="${1:-}"
detail="${2:-}"
status="${3:-failure}"
if [[ -z "${source_name}" || -z "${detail}" ]]; then
  echo "사용법: $0 SOURCE DETAIL [failure|recovery]" >&2
  exit 2
fi
validate_input "${status}" "${DRY_RUN}"
command -v "${GH_BIN}" >/dev/null || { echo "gh 명령을 찾을 수 없습니다: ${GH_BIN}" >&2; exit 1; }

"${GH_BIN}" workflow run host-operation-alert.yml \
  --repo "${REPOSITORY}" \
  --ref main \
  -f source="${source_name}" \
  -f detail="${detail}" \
  -f status="${status}" \
  -f dry_run="${DRY_RUN}"
