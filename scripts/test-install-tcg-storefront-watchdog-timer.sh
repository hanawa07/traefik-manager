#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR="$(mktemp -d)"
readonly SCRIPT_DIR TEMP_DIR
readonly FAKE_BIN="${TEMP_DIR}/bin"
readonly HOME_DIR="${TEMP_DIR}/home"
readonly CONFIG_DIR="${TEMP_DIR}/config"
readonly STATE_DIR="${TEMP_DIR}/state"
readonly SYSTEMCTL_LOG="${TEMP_DIR}/systemctl.log"
readonly ANALYZE_LOG="${TEMP_DIR}/systemd-analyze.log"
readonly BASELINE_LOG="${TEMP_DIR}/baseline.log"
trap 'rm -rf "${TEMP_DIR}"' EXIT

mkdir -p "${FAKE_BIN}" "${HOME_DIR}"
cat > "${FAKE_BIN}/systemctl" <<'SCRIPT'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "${TM_TCG_TEST_SYSTEMCTL_LOG}"
SCRIPT
cat > "${FAKE_BIN}/systemd-analyze" <<'SCRIPT'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "${TM_TCG_TEST_ANALYZE_LOG}"
SCRIPT
cat > "${FAKE_BIN}/baseline-refresh" <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "${TM_TCG_TEST_BASELINE_LOG}"
[[ "${TM_TCG_TEST_BASELINE_FAIL:-0}" != "1" ]]
SCRIPT
chmod 700 "${FAKE_BIN}/systemctl" "${FAKE_BIN}/systemd-analyze" \
  "${FAKE_BIN}/baseline-refresh"

HOME="${HOME_DIR}" \
XDG_CONFIG_HOME="${CONFIG_DIR}" \
TM_TCG_STOREFRONT_STATE_DIR="${STATE_DIR}" \
TM_TCG_TEST_SYSTEMCTL_LOG="${SYSTEMCTL_LOG}" \
TM_TCG_TEST_ANALYZE_LOG="${ANALYZE_LOG}" \
TM_TCG_TEST_BASELINE_LOG="${BASELINE_LOG}" \
TM_USER_SYSTEMD_WATCHDOG_SCRIPT="${FAKE_BIN}/baseline-refresh" \
PATH="${FAKE_BIN}:${PATH}" \
  "${SCRIPT_DIR}/install-tcg-storefront-watchdog-timer.sh"

service_unit="${CONFIG_DIR}/systemd/user/traefik-manager-tcg-storefront-watchdog.service"
timer_unit="${CONFIG_DIR}/systemd/user/traefik-manager-tcg-storefront-watchdog.timer"
grep -Fxq "ConditionFileIsExecutable=${SCRIPT_DIR}/tcg-storefront-watchdog.sh" "${service_unit}"
grep -Fxq "Environment=TM_TCG_STOREFRONT_STATE_DIR=${STATE_DIR}" "${service_unit}"
grep -Fxq "StandardOutput=append:${STATE_DIR}/tcg-storefront-watchdog.log" "${service_unit}"
grep -Fxq 'NoNewPrivileges=yes' "${service_unit}"
grep -Fxq 'PrivateTmp=yes' "${service_unit}"
grep -Fxq 'OnCalendar=*:0/15' "${timer_unit}"
grep -Fxq 'Persistent=true' "${timer_unit}"
grep -Fq -- '--user verify' "${ANALYZE_LOG}"
grep -Fq 'enable --now traefik-manager-tcg-storefront-watchdog.timer' "${SYSTEMCTL_LOG}"
grep -Fxq -- '--refresh-baseline traefik-manager-tcg-storefront-watchdog.timer traefik-manager-tcg-storefront-watchdog.service' \
  "${BASELINE_LOG}"
if grep -Fq 'start traefik-manager-tcg-storefront-watchdog.service' "${SYSTEMCTL_LOG}"; then
  echo "설치기가 TCG watchdog service를 직접 실행했습니다" >&2
  exit 1
fi

if TM_TCG_TEST_BASELINE_FAIL=1 \
  HOME="${HOME_DIR}" \
  XDG_CONFIG_HOME="${CONFIG_DIR}" \
  TM_TCG_STOREFRONT_STATE_DIR="${STATE_DIR}" \
  TM_TCG_TEST_SYSTEMCTL_LOG="${SYSTEMCTL_LOG}" \
  TM_TCG_TEST_ANALYZE_LOG="${ANALYZE_LOG}" \
  TM_TCG_TEST_BASELINE_LOG="${BASELINE_LOG}" \
  TM_USER_SYSTEMD_WATCHDOG_SCRIPT="${FAKE_BIN}/baseline-refresh" \
  PATH="${FAKE_BIN}:${PATH}" \
    "${SCRIPT_DIR}/install-tcg-storefront-watchdog-timer.sh" \
    > "${TEMP_DIR}/baseline-failure.out" 2>&1; then
  echo "기준선 갱신 실패가 설치 성공으로 처리되었습니다" >&2
  exit 1
fi

echo "TCG storefront watchdog timer 설치 self-test 통과"
