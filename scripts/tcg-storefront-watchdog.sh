#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
readonly STATE_DIR="${TM_TCG_STOREFRONT_STATE_DIR:-${XDG_STATE_HOME:-${HOME}/.local/state}/traefik-manager}"
readonly STATE_FILE="${STATE_DIR}/tcg-storefront-watchdog.state"
readonly LOCK_FILE="${STATE_DIR}/tcg-storefront-watchdog.lock"
readonly NODE_BIN="${TM_TCG_STOREFRONT_NODE_BIN:-/usr/bin/node}"
readonly PROBE_SCRIPT="${TM_TCG_STOREFRONT_PROBE_SCRIPT:-${SCRIPT_DIR}/tcg-storefront-probe.mjs}"
readonly ALERT_SCRIPT="${TM_TCG_STOREFRONT_ALERT_SCRIPT:-${SCRIPT_DIR}/request-host-operation-alert.sh}"
readonly FAILURE_THRESHOLD="${TM_TCG_STOREFRONT_FAILURE_THRESHOLD:-2}"
readonly COOLDOWN_SECONDS="${TM_TCG_STOREFRONT_COOLDOWN_SECONDS:-3600}"
readonly ALERT_SOURCE="TCG 구매·SNS 로그인 외부 점검"

read_state() {
  local key="$1"
  [[ -f "${STATE_FILE}" ]] || return 0
  awk -F= -v target="${key}" '$1 == target { print substr($0, index($0, "=") + 1); exit }' \
    "${STATE_FILE}"
}

write_state() {
  local temporary_file
  temporary_file="$(mktemp "${STATE_FILE}.tmp.XXXXXX")"
  {
    printf 'status=%s\n' "$1"
    printf 'alert_active=%s\n' "$2"
    printf 'last_alert_at=%s\n' "$3"
    printf 'consecutive_failures=%s\n' "$4"
    printf 'last_check_at=%s\n' "$5"
    printf 'last_provider_check_date=%s\n' "$6"
    printf 'provider_failure=%s\n' "$7"
    printf 'detail=%s\n' "$8"
  } > "${temporary_file}"
  chmod 644 "${temporary_file}"
  mv "${temporary_file}" "${STATE_FILE}"
}

for value in "${FAILURE_THRESHOLD}" "${COOLDOWN_SECONDS}"; do
  [[ "${value}" =~ ^[1-9][0-9]*$ ]] || {
    echo "watchdog 설정은 양의 정수여야 합니다: ${value}" >&2
    exit 2
  }
done
for command_name in awk flock mktemp mv "${NODE_BIN}" "${ALERT_SCRIPT}"; do
  command -v "${command_name}" >/dev/null || {
    echo "필수 명령을 찾을 수 없습니다: ${command_name}" >&2
    exit 1
  }
done
[[ -f "${PROBE_SCRIPT}" ]] || { echo "TCG storefront probe를 찾을 수 없습니다" >&2; exit 1; }

mkdir -p "${STATE_DIR}"
exec 9>"${LOCK_FILE}"
flock -n 9 || exit 0

previous_status="$(read_state status)"
alert_active="$(read_state alert_active)"
last_alert_at="$(read_state last_alert_at)"
consecutive_failures="$(read_state consecutive_failures)"
last_provider_check_date="$(read_state last_provider_check_date)"
provider_failure="$(read_state provider_failure)"
[[ "${previous_status}" =~ ^(healthy|unhealthy)$ ]] || previous_status="unknown"
[[ "${alert_active}" =~ ^[01]$ ]] || alert_active="0"
[[ "${last_alert_at}" =~ ^[0-9]+$ ]] || last_alert_at="0"
[[ "${consecutive_failures}" =~ ^[0-9]+$ ]] || consecutive_failures="0"
[[ "${provider_failure}" =~ ^[01]$ ]] || provider_failure="0"

today_kst="$(TZ=Asia/Seoul date +%F)"
hour_kst="$(TZ=Asia/Seoul date +%H)"
probe_args=()
verify_provider="0"
if [[ "${TM_TCG_STOREFRONT_FORCE_OAUTH_PROVIDER_CHECK:-0}" == "1" || \
  "${provider_failure}" == "1" || \
  $((10#${hour_kst})) -ge 6 && "${last_provider_check_date}" != "${today_kst}" ]]; then
  probe_args+=(--verify-oauth-providers)
  verify_provider="1"
fi

if probe_output="$("${NODE_BIN}" "${PROBE_SCRIPT}" "${probe_args[@]}" 2>&1)"; then
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
probe_output="${probe_output//$'\n'/ }"
probe_output="${probe_output:0:300}"
now_epoch="$(date +%s)"
current_provider_failure="${provider_failure}"
if [[ "${verify_provider}" == "1" ]]; then
  last_provider_check_date="${today_kst}"
  if [[ "${probe_output}" == *"providerFailure=1"* ]]; then
    current_provider_failure="1"
  elif [[ "${current_status}" == "healthy" ]]; then
    current_provider_failure="0"
  fi
fi

action="none"
if [[ "${current_status}" == "healthy" && "${previous_status}" == "unhealthy" && "${alert_active}" == "1" ]]; then
  action="recovery"
elif [[ "${current_status}" == "unhealthy" && "${current_consecutive_failures}" -ge "${FAILURE_THRESHOLD}" ]]; then
  if [[ "${alert_active}" == "0" || $((now_epoch - last_alert_at)) -ge "${COOLDOWN_SECONDS}" ]]; then
    action="failure"
  fi
fi

if [[ "${action}" == "failure" ]]; then
  if "${ALERT_SCRIPT}" "${ALERT_SOURCE}" \
    "연속 실패 ${current_consecutive_failures}회 · ${probe_output}" failure >/dev/null; then
    alert_active="1"
    last_alert_at="${now_epoch}"
  else
    write_state "${current_status}" "${alert_active}" "${last_alert_at}" \
      "${current_consecutive_failures}" "${now_epoch}" "${last_provider_check_date}" \
      "${current_provider_failure}" "${probe_output}"
    echo "TCG storefront 장애 알림 전송 실패" >&2
    exit 1
  fi
elif [[ "${action}" == "recovery" ]]; then
  if "${ALERT_SCRIPT}" "${ALERT_SOURCE}" \
    "정상 복구 · 장애 중 연속 실패 ${consecutive_failures}회" recovery >/dev/null; then
    alert_active="0"
  else
    write_state unhealthy 1 "${last_alert_at}" "${consecutive_failures}" "${now_epoch}" \
      "${last_provider_check_date}" "${current_provider_failure}" "recovery-alert-failed"
    echo "TCG storefront 복구 알림 전송 실패" >&2
    exit 1
  fi
fi

write_state "${current_status}" "${alert_active}" "${last_alert_at}" \
  "${current_consecutive_failures}" "${now_epoch}" "${last_provider_check_date}" \
  "${current_provider_failure}" "${probe_output}"
echo "$(date --iso-8601=seconds) TCG storefront ${current_status} (${probe_output})"
