#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly TEMP_DIR="$(mktemp -d)"
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
printf '%s\n' \
  '#!/usr/bin/env bash' \
  'set -euo pipefail' \
  'printf "%s\n" "$*" >> "${TM_WATCHDOG_FAKE_CURL_LOG}"' \
  'status="$(<"${TM_WATCHDOG_FAKE_STATUS_FILE}")"' \
  'if [[ "${status}" == "healthy" ]]; then printf "200"; else printf "503"; fi' \
  > "${FAKE_BIN}/curl"
printf '%s\n' \
  '#!/usr/bin/env bash' \
  'set -euo pipefail' \
  'printf "%s\n" "$*" >> "${TM_WATCHDOG_FAKE_DISPATCH_LOG}"' \
  '[[ "$(<"${TM_WATCHDOG_FAKE_DISPATCH_STATUS_FILE}")" == "success" ]]' \
  > "${FAKE_BIN}/gh"
chmod +x "${FAKE_BIN}/curl" "${FAKE_BIN}/gh"

run_watchdog() {
  PATH="/usr/bin:/bin" \
  TM_MANAGER_WATCHDOG_CURL_BIN="${FAKE_BIN}/curl" \
  TM_MANAGER_WATCHDOG_GH_BIN="${FAKE_BIN}/gh" \
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
  grep -qx "status=${expected_status}" "${STATE_DIR}/manager-health-watchdog.state"
  grep -qx "alert_active=${expected_alert_active}" "${STATE_DIR}/manager-health-watchdog.state"
  grep -qx "consecutive_failures=${expected_consecutive_failures}" "${STATE_DIR}/manager-health-watchdog.state"
  grep -qx "last_dispatch_event=${expected_dispatch_event}" "${STATE_DIR}/manager-health-watchdog.state"
  grep -qx "last_dispatch_success=${expected_dispatch_success}" "${STATE_DIR}/manager-health-watchdog.state"
  grep -Eq '^last_dispatch_at=[0-9]+$' "${STATE_DIR}/manager-health-watchdog.state"
}

printf 'success' > "${DISPATCH_STATUS_FILE}"
printf 'healthy' > "${STATUS_FILE}"
run_watchdog
assert_state healthy 0 0 "" ""
[[ "$(stat --format='%a' "${STATE_DIR}/manager-health-watchdog.state")" == "644" ]]
[[ ! -s "${DISPATCH_LOG}" ]]

printf 'unhealthy' > "${STATUS_FILE}"
run_watchdog
assert_state unhealthy 1 1 failure 1
grep -q -- '-f status=failure' "${DISPATCH_LOG}"

run_watchdog
assert_state unhealthy 1 2 failure 1

printf 'healthy' > "${STATUS_FILE}"
run_watchdog
assert_state healthy 0 0 recovery 1
grep -q -- '-f status=recovery' "${DISPATCH_LOG}"
grep -q -- '장애 중 연속 실패 2회' "${DISPATCH_LOG}"

printf 'failure' > "${DISPATCH_STATUS_FILE}"
printf 'unhealthy' > "${STATUS_FILE}"
rm -f "${STATE_DIR}/manager-health-watchdog.state"
if run_watchdog; then
  echo "watchdog 통합 시험이 알림 요청 실패를 성공으로 처리했습니다" >&2
  exit 1
fi
assert_state unhealthy 0 1 failure 0

[[ "$(wc -l < "${CURL_LOG}")" -eq 5 ]]
[[ "$(wc -l < "${DISPATCH_LOG}")" -eq 3 ]]
if grep -v -q 'https://watchdog.invalid/api/health' "${CURL_LOG}"; then
  echo "watchdog 통합 시험이 예상하지 않은 URL을 호출했습니다" >&2
  exit 1
fi

echo "Manager watchdog 무중단 장애·복구 통합 시험 통과"
