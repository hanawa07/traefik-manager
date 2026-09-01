#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR="$(mktemp -d)"
readonly SCRIPT_DIR TEMP_DIR
readonly STATE_DIR="${TEMP_DIR}/state"
readonly FAKE_NODE="${TEMP_DIR}/node"
readonly FAKE_ALERT="${TEMP_DIR}/alert"
readonly PROBE_STATUS="${TEMP_DIR}/probe-status"
readonly PROBE_LOG="${TEMP_DIR}/probe.log"
readonly ALERT_STATUS="${TEMP_DIR}/alert-status"
readonly ALERT_LOG="${TEMP_DIR}/alert.log"
trap 'rm -rf "${TEMP_DIR}"' EXIT

mkdir -p "${STATE_DIR}"
cat > "${FAKE_NODE}" <<'SCRIPT'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "${TM_TCG_TEST_PROBE_LOG}"
case "$(<"${TM_TCG_TEST_PROBE_STATUS}")" in
  healthy) echo 'healthy providerFailure=0 checks=7 providerCheck=skipped' ;;
  provider-failure) echo 'unhealthy providerFailure=1 failures=kakaoLogin:oauth-provider-configuration-error'; exit 1 ;;
  *) echo 'unhealthy providerFailure=0 failures=catalog:HTTP-503'; exit 1 ;;
esac
SCRIPT
cat > "${FAKE_ALERT}" <<'SCRIPT'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "${TM_TCG_TEST_ALERT_LOG}"
[[ "$(<"${TM_TCG_TEST_ALERT_STATUS}")" == "success" ]]
SCRIPT
chmod 700 "${FAKE_NODE}" "${FAKE_ALERT}"

run_watchdog() {
  TM_TCG_STOREFRONT_STATE_DIR="${STATE_DIR}" \
  TM_TCG_STOREFRONT_NODE_BIN="${FAKE_NODE}" \
  TM_TCG_STOREFRONT_PROBE_SCRIPT="${SCRIPT_DIR}/tcg-storefront-probe.mjs" \
  TM_TCG_STOREFRONT_ALERT_SCRIPT="${FAKE_ALERT}" \
  TM_TCG_STOREFRONT_FAILURE_THRESHOLD=2 \
  TM_TCG_STOREFRONT_COOLDOWN_SECONDS=3600 \
  TM_TCG_TEST_PROBE_STATUS="${PROBE_STATUS}" \
  TM_TCG_TEST_PROBE_LOG="${PROBE_LOG}" \
  TM_TCG_TEST_ALERT_STATUS="${ALERT_STATUS}" \
  TM_TCG_TEST_ALERT_LOG="${ALERT_LOG}" \
    "${SCRIPT_DIR}/tcg-storefront-watchdog.sh"
}

assert_state() {
  grep -Fxq "status=$1" "${STATE_DIR}/tcg-storefront-watchdog.state"
  grep -Fxq "alert_active=$2" "${STATE_DIR}/tcg-storefront-watchdog.state"
  grep -Fxq "consecutive_failures=$3" "${STATE_DIR}/tcg-storefront-watchdog.state"
  grep -Fxq "provider_failure=$4" "${STATE_DIR}/tcg-storefront-watchdog.state"
}

node "${SCRIPT_DIR}/tcg-storefront-probe.mjs" --self-test
printf 'success' > "${ALERT_STATUS}"
printf 'healthy' > "${PROBE_STATUS}"
run_watchdog
assert_state healthy 0 0 0
[[ ! -s "${ALERT_LOG}" ]]

printf 'failure' > "${PROBE_STATUS}"
run_watchdog
assert_state unhealthy 0 1 0
[[ ! -s "${ALERT_LOG}" ]]
run_watchdog
assert_state unhealthy 1 2 0
[[ "$(wc -l < "${ALERT_LOG}")" -eq 1 ]]
run_watchdog
assert_state unhealthy 1 3 0
[[ "$(wc -l < "${ALERT_LOG}")" -eq 1 ]]

printf 'healthy' > "${PROBE_STATUS}"
run_watchdog
assert_state healthy 0 0 0
[[ "$(wc -l < "${ALERT_LOG}")" -eq 2 ]]
grep -Fq 'recovery' "${ALERT_LOG}"

printf 'provider-failure' > "${PROBE_STATUS}"
TM_TCG_STOREFRONT_FORCE_OAUTH_PROVIDER_CHECK=1 run_watchdog
run_watchdog
assert_state unhealthy 1 2 1
tail -n 2 "${PROBE_LOG}" | grep -Fq -- '--verify-oauth-providers'

printf 'healthy' > "${PROBE_STATUS}"
run_watchdog
assert_state healthy 0 0 0
tail -n 1 "${PROBE_LOG}" | grep -Fq -- '--verify-oauth-providers'

printf 'TCG storefront 외부 watchdog 무메일 통합 시험 통과\n'
