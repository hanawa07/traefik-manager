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
  local temporary_file
  temporary_file="$(mktemp "${STATE_FILE}.tmp.XXXXXX")"
  printf 'status=%s\nalert_active=%s\nlast_alert_at=%s\n' \
    "${status}" "${alert_active}" "${last_alert_at}" > "${temporary_file}"
  chmod 600 "${temporary_file}"
  mv "${temporary_file}" "${STATE_FILE}"
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

dispatch_alert() {
  local status="$1"
  local detail="$2"
  "${GH_BIN}" workflow run host-operation-alert.yml \
    --repo "${WATCHDOG_REPOSITORY}" \
    --ref main \
    -f source="Manager 외부 가용성 watchdog" \
    -f detail="${detail}" \
    -f status="${status}"
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
[[ "${previous_status}" =~ ^(healthy|unhealthy)$ ]] || previous_status="unknown"
[[ "${alert_active}" =~ ^[01]$ ]] || alert_active="0"
[[ "${last_alert_at}" =~ ^[0-9]+$ ]] || last_alert_at="0"

if check_health; then
  current_status="healthy"
else
  current_status="unhealthy"
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
    if dispatch_alert failure "공개 health API 장애 (${health_detail})"; then
      write_state unhealthy 1 "${now_epoch}"
      echo "$(date --iso-8601=seconds) Manager 외부 장애 알림 요청 완료 (${health_detail})"
    else
      write_state unhealthy 0 "${last_alert_at}"
      echo "Manager 외부 장애 알림 요청에 실패했습니다" >&2
      exit 1
    fi
    ;;
  recovery)
    if dispatch_alert recovery "공개 health API 복구 (${health_detail})"; then
      write_state healthy 0 "${last_alert_at}"
      echo "$(date --iso-8601=seconds) Manager 외부 복구 알림 요청 완료 (${health_detail})"
    else
      echo "Manager 외부 복구 알림 요청에 실패했습니다" >&2
      exit 1
    fi
    ;;
  none)
    write_state "${current_status}" "${alert_active}" "${last_alert_at}"
    ;;
esac
