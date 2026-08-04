#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR="$(mktemp -d)"
readonly SCRIPT_DIR
readonly TEMP_DIR
readonly FAKE_BIN="${TEMP_DIR}/bin"
readonly STATE_DIR="${TEMP_DIR}/state"
readonly STATUS_FILE="${TEMP_DIR}/health-status"
readonly CURL_LOG="${TEMP_DIR}/curl.log"
readonly DISPATCH_LOG="${TEMP_DIR}/dispatch.log"
readonly DISPATCH_STATUS_FILE="${TEMP_DIR}/dispatch-status"

cleanup() {
  rm -rf "${TEMP_DIR}"
}
trap cleanup EXIT

mkdir -p "${FAKE_BIN}" "${STATE_DIR}"
cat > "${FAKE_BIN}/curl" <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "${TM_WATCHDOG_FAKE_CURL_LOG}"
status="$(<"${TM_WATCHDOG_FAKE_STATUS_FILE}")"
if [[ "${status}" == "healthy" ]]; then printf '200'; else printf '503'; fi
SCRIPT
cat > "${FAKE_BIN}/docker" <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "${TM_WATCHDOG_FAKE_DISPATCH_LOG}"
[[ "$(<"${TM_WATCHDOG_FAKE_DISPATCH_STATUS_FILE}")" == "success" ]] || exit 1
printf 'ANUBIS_MANAGER_HEALTH_ALERT=sent\n'
SCRIPT
chmod +x "${FAKE_BIN}/curl" "${FAKE_BIN}/docker"

run_watchdog() {
  PATH="/usr/bin:/bin" \
  TM_MANAGER_WATCHDOG_CURL_BIN="${FAKE_BIN}/curl" \
  TM_MANAGER_WATCHDOG_DOCKER_BIN="${FAKE_BIN}/docker" \
  TM_MANAGER_WATCHDOG_STATE_DIR="${STATE_DIR}" \
  TM_MANAGER_WATCHDOG_URL="https://watchdog.invalid" \
  TM_MANAGER_WATCHDOG_TIMEOUT_SECONDS=1 \
  TM_WATCHDOG_FAKE_STATUS_FILE="${STATUS_FILE}" \
  TM_WATCHDOG_FAKE_CURL_LOG="${CURL_LOG}" \
  TM_WATCHDOG_FAKE_DISPATCH_LOG="${DISPATCH_LOG}" \
  TM_WATCHDOG_FAKE_DISPATCH_STATUS_FILE="${DISPATCH_STATUS_FILE}" \
    "${SCRIPT_DIR}/manager-health-watchdog.sh"
}

assert_state() {
  local expected_status="$1"
  local expected_alert_active="$2"
  local expected_consecutive_failures="$3"
  local expected_dispatch_event="$4"
  local expected_dispatch_success="$5"
  local expected_dispatch_channel="$6"
  grep -qx "status=${expected_status}" "${STATE_DIR}/manager-health-watchdog.state"
  grep -qx "alert_active=${expected_alert_active}" "${STATE_DIR}/manager-health-watchdog.state"
  grep -qx "consecutive_failures=${expected_consecutive_failures}" "${STATE_DIR}/manager-health-watchdog.state"
  grep -qx "last_dispatch_event=${expected_dispatch_event}" "${STATE_DIR}/manager-health-watchdog.state"
  grep -qx "last_dispatch_success=${expected_dispatch_success}" "${STATE_DIR}/manager-health-watchdog.state"
  grep -Eq '^last_dispatch_at=[0-9]+$' "${STATE_DIR}/manager-health-watchdog.state"
  grep -qx "last_dispatch_channel=${expected_dispatch_channel}" "${STATE_DIR}/manager-health-watchdog.state"
  grep -qx 'last_dispatch_run_url=' "${STATE_DIR}/manager-health-watchdog.state"
  grep -qx 'dispatch_history=' "${STATE_DIR}/manager-health-watchdog.state"
}

printf 'success' > "${DISPATCH_STATUS_FILE}"
printf 'healthy' > "${STATUS_FILE}"
run_watchdog
assert_state healthy 0 0 "" "" ""
[[ "$(stat --format='%a' "${STATE_DIR}/manager-health-watchdog.state")" == "644" ]]
[[ ! -s "${DISPATCH_LOG}" ]]

printf 'unhealthy' > "${STATUS_FILE}"
run_watchdog
assert_state unhealthy 1 1 failure 1 anubis
grep -q -- 'exec anubis node /app/scripts/send-manager-health-alert.js failure HTTP 503 1' "${DISPATCH_LOG}"

run_watchdog
assert_state unhealthy 1 2 failure 1 anubis

printf 'healthy' > "${STATUS_FILE}"
run_watchdog
assert_state healthy 0 0 recovery 1 anubis
grep -q -- 'exec anubis node /app/scripts/send-manager-health-alert.js recovery HTTP 200 2' "${DISPATCH_LOG}"

printf 'failure' > "${DISPATCH_STATUS_FILE}"
printf 'unhealthy' > "${STATUS_FILE}"
rm -f "${STATE_DIR}/manager-health-watchdog.state"
if run_watchdog; then
  echo "watchdog 통합 시험이 알림 요청 실패를 성공으로 처리했습니다" >&2
  exit 1
fi
assert_state unhealthy 0 1 failure 0 anubis

[[ "$(wc -l < "${CURL_LOG}")" -eq 5 ]]
[[ "$(wc -l < "${DISPATCH_LOG}")" -eq 3 ]]
if grep -v -q 'https://watchdog.invalid/api/health' "${CURL_LOG}"; then
  echo "watchdog 통합 시험이 예상하지 않은 URL을 호출했습니다" >&2
  exit 1
fi

echo "Manager watchdog 무중단 장애·복구 통합 시험 통과"
