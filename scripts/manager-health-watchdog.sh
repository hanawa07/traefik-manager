#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly SCRIPT_DIR
readonly REPO_ROOT
readonly STATE_DIR="${TM_MANAGER_WATCHDOG_STATE_DIR:-${XDG_STATE_HOME:-${HOME}/.local/state}/traefik-manager}"
readonly STATE_FILE="${STATE_DIR}/manager-health-watchdog.state"
readonly LOCK_FILE="${STATE_DIR}/manager-health-watchdog.lock"
readonly COOLDOWN_SECONDS="${TM_MANAGER_WATCHDOG_COOLDOWN_SECONDS:-3600}"
readonly REQUEST_TIMEOUT_SECONDS="${TM_MANAGER_WATCHDOG_TIMEOUT_SECONDS:-15}"
readonly CURL_BIN="${TM_MANAGER_WATCHDOG_CURL_BIN:-curl}"
readonly DOCKER_BIN="${TM_MANAGER_WATCHDOG_DOCKER_BIN:-docker}"
# shellcheck source=scripts/manager-health-watchdog-policy.sh
source "${SCRIPT_DIR}/manager-health-watchdog-policy.sh"
# shellcheck source=scripts/manager-health-watchdog-state.sh
source "${SCRIPT_DIR}/manager-health-watchdog-state.sh"

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
    base_url="$(read_env_value TAILNET_FRONTEND_URL)"
  fi
  if [[ -z "${base_url}" ]]; then
    base_url="$(read_env_value FRONTEND_DOMAIN)"
  fi
  if [[ -z "${base_url}" ]]; then
    echo "TM_MANAGER_WATCHDOG_URL 또는 .env의 TAILNET_FRONTEND_URL/FRONTEND_DOMAIN이 필요합니다" >&2
    return 1
  fi
  if [[ "${base_url}" != http://* && "${base_url}" != https://* ]]; then
    base_url="https://${base_url}"
  fi
  printf '%s/api/health\n' "${base_url%/}"
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
    health_detail="connection-failed"
    return 1
  }
  health_detail="HTTP ${http_code}"
  [[ "${http_code}" == "200" ]]
}

send_direct_alert() {
  local event="$1"
  local detail="$2"
  local failure_count="$3"
  local result
  result="$(
    "${DOCKER_BIN}" exec anubis node /app/scripts/send-manager-health-alert.js \
      "${event}" "${detail}" "${failure_count}"
  )" || return 1
  [[ "${result}" == "ANUBIS_MANAGER_HEALTH_ALERT=sent" ]]
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
for command_name in awk "${CURL_BIN}" "${DOCKER_BIN}" flock mktemp; do
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
last_dispatch_channel="$(read_state_value last_dispatch_channel)"
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
if [[ ! "${last_dispatch_channel}" =~ ^(anubis|github)$ ]]; then
  [[ -n "${last_dispatch_run_url}" ]] && last_dispatch_channel="github" || last_dispatch_channel=""
fi
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
    if send_direct_alert failure "${health_detail}" "${current_consecutive_failures}"; then
      write_state unhealthy 1 "${now_epoch}" "${current_consecutive_failures}" failure 1 "${now_epoch}" anubis "" "${dispatch_history}"
      echo "$(date --iso-8601=seconds) Manager 외부 장애 알림 직접 전송 완료 (${health_detail}, 연속 실패 ${current_consecutive_failures}회)"
    else
      write_state unhealthy 0 "${last_alert_at}" "${current_consecutive_failures}" failure 0 "${now_epoch}" anubis "" "${dispatch_history}"
      echo "Manager 외부 장애 알림 직접 전송에 실패했습니다" >&2
      exit 1
    fi
    ;;
  recovery)
    if send_direct_alert recovery "${health_detail}" "${consecutive_failures}"; then
      write_state healthy 0 "${last_alert_at}" 0 recovery 1 "${now_epoch}" anubis "" "${dispatch_history}"
      echo "$(date --iso-8601=seconds) Manager 외부 복구 알림 직접 전송 완료 (${health_detail}, 장애 중 연속 실패 ${consecutive_failures}회)"
    else
      write_state unhealthy 1 "${last_alert_at}" "${consecutive_failures}" recovery 0 "${now_epoch}" anubis "" "${dispatch_history}"
      echo "Manager 외부 복구 알림 직접 전송에 실패했습니다" >&2
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
      "${last_dispatch_channel}" \
      "${last_dispatch_run_url}" \
      "${dispatch_history}"
    ;;
esac
