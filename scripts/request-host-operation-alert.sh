#!/usr/bin/env bash
set -euo pipefail

SCRIPT_PATH="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/$(basename -- "${BASH_SOURCE[0]}")"
readonly SCRIPT_PATH
readonly GH_BIN="${TM_HOST_OPERATION_ALERT_GH_BIN:-gh}"
readonly REPOSITORY="${TM_HOST_OPERATION_ALERT_REPOSITORY:-hanawa07/traefik-manager}"
readonly DRY_RUN="${TM_HOST_OPERATION_ALERT_DRY_RUN:-false}"

validate_input() {
  local status="$1"
  local dry_run="$2"
  [[ "${status}" == "failure" || "${status}" == "warning" || "${status}" == "recovery" ]] \
    || { echo "알림 상태는 failure, warning, recovery 중 하나여야 합니다" >&2; return 1; }
  [[ "${dry_run}" == "true" || "${dry_run}" == "false" ]] \
    || { echo "dry-run 값은 true 또는 false여야 합니다" >&2; return 1; }
}

latest_alert_run() {
  "${GH_BIN}" run list \
    --repo "${REPOSITORY}" \
    --workflow host-operation-alert.yml \
    --event workflow_dispatch \
    --branch main \
    --limit 1 \
    --json databaseId,url \
    --jq 'if length > 0 then .[0] | "\(.databaseId)\t\(.url)" else empty end' \
    2>/dev/null
}

run_self_test() {
  local temporary_dir fake_gh capture_file run_url
  temporary_dir="$(mktemp -d)"
  trap 'rm -rf "${temporary_dir}"' RETURN
  fake_gh="${temporary_dir}/gh"
  capture_file="${temporary_dir}/arguments"
  cat > "${fake_gh}" <<'SCRIPT'
#!/usr/bin/env bash
if [[ "${1:-} ${2:-}" == "run list" ]]; then
  if [[ -f "${TM_HOST_OPERATION_ALERT_DISPATCHED}" ]]; then
    printf '101\thttps://github.com/hanawa07/traefik-manager/actions/runs/101\n'
  else
    printf '100\thttps://github.com/hanawa07/traefik-manager/actions/runs/100\n'
  fi
  exit 0
fi
printf '%s\n' "$@" > "${TM_HOST_OPERATION_ALERT_CAPTURE}"
touch "${TM_HOST_OPERATION_ALERT_DISPATCHED}"
SCRIPT
  chmod 700 "${fake_gh}"
  run_url="$(
    TM_HOST_OPERATION_ALERT_GH_BIN="${fake_gh}" \
    TM_HOST_OPERATION_ALERT_DRY_RUN=true \
    TM_HOST_OPERATION_ALERT_CAPTURE="${capture_file}" \
    TM_HOST_OPERATION_ALERT_DISPATCHED="${temporary_dir}/dispatched" \
      "${SCRIPT_PATH}" "Manager bottleneck event storage" "보관량 80/100건" warning
  )"
  [[ "${run_url}" == "https://github.com/hanawa07/traefik-manager/actions/runs/101" ]]
  grep -Fxq 'source=Manager bottleneck event storage' "${capture_file}"
  grep -Fxq 'detail=보관량 80/100건' "${capture_file}"
  grep -Fxq 'status=warning' "${capture_file}"
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
  echo "사용법: $0 SOURCE DETAIL [failure|warning|recovery]" >&2
  exit 2
fi
validate_input "${status}" "${DRY_RUN}"
command -v "${GH_BIN}" >/dev/null || { echo "gh 명령을 찾을 수 없습니다: ${GH_BIN}" >&2; exit 1; }

baseline_available=1
if ! previous_record="$(latest_alert_run)"; then
  baseline_available=0
  previous_record=""
fi
previous_run_id="${previous_record%%$'\t'*}"
"${GH_BIN}" workflow run host-operation-alert.yml \
  --repo "${REPOSITORY}" \
  --ref main \
  -f source="${source_name}" \
  -f detail="${detail}" \
  -f status="${status}" \
  -f dry_run="${DRY_RUN}" \
  >/dev/null

for _ in 1 2 3 4 5; do
  if ! current_record="$(latest_alert_run)"; then
    sleep 1
    continue
  fi
  current_run_id="${current_record%%$'\t'*}"
  current_run_url="${current_record#*$'\t'}"
  if (( baseline_available == 1 )) \
    && [[ "${current_run_id}" =~ ^[0-9]+$ && "${current_run_id}" != "${previous_run_id}" ]]; then
    if [[ "${current_run_url}" =~ ^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/actions/runs/[1-9][0-9]*$ ]]; then
      printf '%s\n' "${current_run_url}"
      exit 0
    fi
  fi
  sleep 1
done
echo "호스트 운영 알림 실행 URL을 확인하지 못했습니다" >&2
