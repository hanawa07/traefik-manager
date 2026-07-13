#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"
readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly STATE_DIR="${TM_MANAGER_WATCHDOG_STATE_DIR:-${XDG_STATE_HOME:-${HOME}/.local/state}/traefik-manager}"
readonly STATE_FILE="${STATE_DIR}/manager-health-watchdog.state"
readonly LOCK_FILE="${STATE_DIR}/manager-health-watchdog.lock"
readonly COOLDOWN_SECONDS="${TM_MANAGER_WATCHDOG_COOLDOWN_SECONDS:-3600}"
readonly REQUEST_TIMEOUT_SECONDS="${TM_MANAGER_WATCHDOG_TIMEOUT_SECONDS:-15}"
readonly WATCHDOG_REPOSITORY="${TM_MANAGER_WATCHDOG_REPOSITORY:-hanawa07/traefik-manager}"
readonly CURL_BIN="${TM_MANAGER_WATCHDOG_CURL_BIN:-curl}"
readonly GH_BIN="${TM_MANAGER_WATCHDOG_GH_BIN:-gh}"

decide_action() {
  local current_status="$1"
  local previous_status="$2"
  local alert_active="$3"
  local last_alert_at="$4"
  local now_epoch="$5"
  local cooldown_seconds="$6"

  if [[ "${current_status}" == "healthy" ]]; then
    if [[ "${previous_status}" == "unhealthy" && "${alert_active}" == "1" ]]; then
      printf 'recovery\n'
    else
      printf 'none\n'
    fi
    return
  fi

  if (( last_alert_at == 0 || now_epoch - last_alert_at >= cooldown_seconds )); then
    if [[ "${previous_status}" == "unhealthy" && "${alert_active}" == "1" ]]; then
      printf 'failure_repeat\n'
    else
      printf 'failure\n'
    fi
  else
    printf 'none\n'
  fi
}

assert_decision() {
  local expected="$1"
  shift
  local actual
  actual="$(decide_action "$@")"
  if [[ "${actual}" != "${expected}" ]]; then
    echo "watchdog self-test 실패: expected=${expected}, actual=${actual}" >&2
    exit 1
  fi
}

run_self_test() {
  assert_decision none healthy unknown 0 0 1000 3600
  assert_decision failure unhealthy unknown 0 0 1000 3600
  assert_decision none unhealthy healthy 0 900 1000 3600
  assert_decision failure_repeat unhealthy unhealthy 1 1000 5000 3600
  assert_decision recovery healthy unhealthy 1 1000 1100 3600
  assert_decision none healthy unhealthy 0 1000 1100 3600
  echo "Manager 외부 health watchdog self-test 통과"
}

read_env_value() {
  local key="$1"
  local raw
  raw="$(grep -E "^${key}=" "${REPO_ROOT}/.env" 2>/dev/null | tail -n 1 | cut -d= -f2- || true)"
  raw="${raw%$'\r'}"
  raw="${raw#\"}"
  raw="${raw%\"}"
  raw="${raw#\'}"
  raw="${raw%\'}"
  printf '%s\n' "${raw}"
}

resolve_health_url() {
  local base_url="${TM_MANAGER_WATCHDOG_URL:-}"
  if [[ -z "${base_url}" ]]; then
    base_url="$(read_env_value FRONTEND_DOMAIN)"
  fi
  if [[ -z "${base_url}" ]]; then
    echo "TM_MANAGER_WATCHDOG_URL 또는 .env의 FRONTEND_DOMAIN이 필요합니다" >&2
    return 1
  fi
  if [[ "${base_url}" != http://* && "${base_url}" != https://* ]]; then
    base_url="https://${base_url}"
  fi
  printf '%s/api/health\n' "${base_url%/}"
}

read_state_value() {
  local key="$1"
  if [[ ! -f "${STATE_FILE}" ]]; then
    return
  fi
  awk -F= -v target="${key}" '$1 == target {print substr($0, index($0, "=") + 1); exit}' "${STATE_FILE}"
}

write_state() {
  local status="$1"
  local alert_active="$2"
  local last_alert_at="$3"
  local consecutive_failures="$4"
  local last_dispatch_event="$5"
  local last_dispatch_success="$6"
  local last_dispatch_at="$7"
  local last_dispatch_run_url="$8"
  local dispatch_history="$9"
  local temporary_file
  temporary_file="$(mktemp "${STATE_FILE}.tmp.XXXXXX")"
  printf 'status=%s\nalert_active=%s\nlast_alert_at=%s\nconsecutive_failures=%s\nlast_dispatch_event=%s\nlast_dispatch_success=%s\nlast_dispatch_at=%s\nlast_dispatch_run_url=%s\ndispatch_history=%s\n' \
    "${status}" "${alert_active}" "${last_alert_at}" "${consecutive_failures}" \
    "${last_dispatch_event}" "${last_dispatch_success}" "${last_dispatch_at}" \
    "${last_dispatch_run_url}" "${dispatch_history}" \
    > "${temporary_file}"
  chmod 644 "${temporary_file}"
  mv "${temporary_file}" "${STATE_FILE}"
}

prepend_dispatch_history() {
  local event="$1"
  local dispatched_at="$2"
  local run_url="$3"
  local history="$4"
  if [[ "${run_url}" != https://github.com/*/actions/runs/* ]]; then
    printf '%s\n' "${history}"
    return
  fi
  printf '%s\n' "${event}|${dispatched_at}|${run_url}${history:+,${history}}" \
    | awk -F, '{ for (i = 1; i <= NF && i <= 5; i++) printf "%s%s", (i > 1 ? "," : ""), $i; print "" }'
}

check_health() {
  local http_code
  http_code="$(
    "${CURL_BIN}" --location --silent --show-error \
      --max-time "${REQUEST_TIMEOUT_SECONDS}" \
      --output /dev/null \
      --write-out '%{http_code}' \
      "${health_url}"
  )" || {
    health_detail="연결 실패"
    return 1
  }
  health_detail="HTTP ${http_code}"
  [[ "${http_code}" == "200" ]]
}

latest_alert_run() {
  "${GH_BIN}" run list \
    --repo "${WATCHDOG_REPOSITORY}" \
    --workflow host-operation-alert.yml \
    --event workflow_dispatch \
    --branch main \
    --limit 1 \
    --json databaseId,url \
    --jq '.[0] | "\(.databaseId)\t\(.url)"' \
    2>/dev/null || true
}

dispatch_alert() {
  local status="$1"
  local detail="$2"
  local previous_record previous_run_id current_record current_run_id current_run_url
  dispatch_run_url=""
  previous_record="$(latest_alert_run)"
  previous_run_id="${previous_record%%$'\t'*}"
  "${GH_BIN}" workflow run host-operation-alert.yml \
    --repo "${WATCHDOG_REPOSITORY}" \
    --ref main \
    -f source="Manager 외부 가용성 watchdog" \
    -f detail="${detail}" \
    -f status="${status}" || return 1

  for _ in 1 2 3 4 5; do
    current_record="$(latest_alert_run)"
    current_run_id="${current_record%%$'\t'*}"
    current_run_url="${current_record#*$'\t'}"
    if [[ "${current_run_id}" =~ ^[0-9]+$ && "${current_run_id}" != "${previous_run_id}" ]]; then
      if [[ "${current_run_url}" == https://github.com/*/actions/runs/* ]]; then
        dispatch_run_url="${current_run_url}"
      fi
      break
    fi
    sleep 1
  done
  return 0
}

if [[ "${1:-}" == "--self-test" ]]; then
  run_self_test
  exit 0
fi

for numeric_value in "${COOLDOWN_SECONDS}" "${REQUEST_TIMEOUT_SECONDS}"; do
  if [[ ! "${numeric_value}" =~ ^[1-9][0-9]*$ ]]; then
    echo "watchdog 시간 설정은 양의 정수여야 합니다: ${numeric_value}" >&2
    exit 1
  fi
done
for command_name in awk "${CURL_BIN}" flock "${GH_BIN}" mktemp; do
  command -v "${command_name}" >/dev/null || {
    echo "필수 명령을 찾을 수 없습니다: ${command_name}" >&2
    exit 1
  }
done

mkdir -p "${STATE_DIR}"
exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
  exit 0
fi

health_url="$(resolve_health_url)"
health_detail=""
now_epoch="$(date +%s)"
previous_status="$(read_state_value status)"
alert_active="$(read_state_value alert_active)"
last_alert_at="$(read_state_value last_alert_at)"
consecutive_failures="$(read_state_value consecutive_failures)"
last_dispatch_event="$(read_state_value last_dispatch_event)"
last_dispatch_success="$(read_state_value last_dispatch_success)"
last_dispatch_at="$(read_state_value last_dispatch_at)"
last_dispatch_run_url="$(read_state_value last_dispatch_run_url)"
dispatch_history="$(read_state_value dispatch_history)"
[[ "${previous_status}" =~ ^(healthy|unhealthy)$ ]] || previous_status="unknown"
[[ "${alert_active}" =~ ^[01]$ ]] || alert_active="0"
[[ "${last_alert_at}" =~ ^[0-9]+$ ]] || last_alert_at="0"
[[ "${consecutive_failures}" =~ ^[0-9]+$ ]] || consecutive_failures="0"
[[ "${last_dispatch_event}" =~ ^(failure|recovery)$ ]] || last_dispatch_event=""
[[ "${last_dispatch_success}" =~ ^[01]$ ]] || last_dispatch_success=""
[[ "${last_dispatch_at}" =~ ^[0-9]+$ ]] || last_dispatch_at="0"
[[ "${last_dispatch_run_url}" == https://github.com/*/actions/runs/* ]] || last_dispatch_run_url=""
if [[ -z "${dispatch_history}" && -n "${last_dispatch_run_url}" && -n "${last_dispatch_event}" && "${last_dispatch_at}" != "0" ]]; then
  dispatch_history="${last_dispatch_event}|${last_dispatch_at}|${last_dispatch_run_url}"
fi

if check_health; then
  current_status="healthy"
  current_consecutive_failures="0"
else
  current_status="unhealthy"
  if [[ "${previous_status}" == "unhealthy" ]]; then
    current_consecutive_failures="$((consecutive_failures + 1))"
  else
    current_consecutive_failures="1"
  fi
fi
action="$(
  decide_action \
    "${current_status}" \
    "${previous_status}" \
    "${alert_active}" \
    "${last_alert_at}" \
    "${now_epoch}" \
    "${COOLDOWN_SECONDS}"
)"

case "${action}" in
  failure|failure_repeat)
    if dispatch_alert failure "공개 health API 장애 (${health_detail}, 연속 실패 ${current_consecutive_failures}회)"; then
      dispatch_history="$(prepend_dispatch_history failure "${now_epoch}" "${dispatch_run_url}" "${dispatch_history}")"
      write_state unhealthy 1 "${now_epoch}" "${current_consecutive_failures}" failure 1 "${now_epoch}" "${dispatch_run_url}" "${dispatch_history}"
      echo "$(date --iso-8601=seconds) Manager 외부 장애 알림 요청 완료 (${health_detail}, 연속 실패 ${current_consecutive_failures}회)"
    else
      write_state unhealthy 0 "${last_alert_at}" "${current_consecutive_failures}" failure 0 "${now_epoch}" "" "${dispatch_history}"
      echo "Manager 외부 장애 알림 요청에 실패했습니다" >&2
      exit 1
    fi
    ;;
  recovery)
    if dispatch_alert recovery "공개 health API 복구 (${health_detail}, 장애 중 연속 실패 ${consecutive_failures}회)"; then
      dispatch_history="$(prepend_dispatch_history recovery "${now_epoch}" "${dispatch_run_url}" "${dispatch_history}")"
      write_state healthy 0 "${last_alert_at}" 0 recovery 1 "${now_epoch}" "${dispatch_run_url}" "${dispatch_history}"
      echo "$(date --iso-8601=seconds) Manager 외부 복구 알림 요청 완료 (${health_detail}, 장애 중 연속 실패 ${consecutive_failures}회)"
    else
      write_state unhealthy 1 "${last_alert_at}" "${consecutive_failures}" recovery 0 "${now_epoch}" "" "${dispatch_history}"
      echo "Manager 외부 복구 알림 요청에 실패했습니다" >&2
      exit 1
    fi
    ;;
  none)
    write_state \
      "${current_status}" \
      "${alert_active}" \
      "${last_alert_at}" \
      "${current_consecutive_failures}" \
      "${last_dispatch_event}" \
      "${last_dispatch_success}" \
      "${last_dispatch_at}" \
      "${last_dispatch_run_url}" \
      "${dispatch_history}"
    ;;
esac
