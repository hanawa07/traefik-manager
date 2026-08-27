#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR="$(mktemp -d)"
readonly SCRIPT_DIR TEMP_DIR
readonly FAKE_BIN="${TEMP_DIR}/bin"
readonly HOME_DIR="${TEMP_DIR}/home"
readonly CONFIG_DIR="${TEMP_DIR}/config"
readonly STATE_DIR="${TEMP_DIR}/state"
readonly BASELINE_FILE="${STATE_DIR}/baseline.sha256"
readonly SYSTEMCTL_LOG="${TEMP_DIR}/systemctl.log"
readonly ANALYZE_LOG="${TEMP_DIR}/systemd-analyze.log"
trap 'rm -rf "${TEMP_DIR}"' EXIT

mkdir -p "${FAKE_BIN}" "${HOME_DIR}"
cat > "${FAKE_BIN}/systemctl" <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "${TM_USER_SYSTEMD_INSTALL_TEST_SYSTEMCTL_LOG}"
case "${2:-}" in
  list-unit-files)
    printf '%s\n' \
      'sample.timer enabled enabled' \
      'traefik-manager-user-systemd-watchdog.timer enabled enabled'
    ;;
  show)
    unit="${3:-}"
    property=""
    for argument in "$@"; do
      [[ "${argument}" == --property=* ]] && property="${argument#--property=}"
    done
    case "${property}" in
      ActiveState) [[ "${unit}" == *.timer ]] && printf '%s\n' active || printf '%s\n' inactive ;;
      Triggers) printf '%s\n' "${unit%.timer}.service" ;;
      LoadState) printf '%s\n' loaded ;;
      Result) printf '%s\n' success ;;
      ExecMainStatus) printf '%s\n' 0 ;;
      *) exit 2 ;;
    esac
    ;;
  is-enabled) printf '%s\n' enabled ;;
  is-active) ;;
  cat) printf 'unit=%s\n' "${3:-}" ;;
  daemon-reload|enable) ;;
  *) exit 2 ;;
esac
SCRIPT
cat > "${FAKE_BIN}/systemd-analyze" <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "${TM_USER_SYSTEMD_INSTALL_TEST_ANALYZE_LOG}"
SCRIPT
chmod 700 "${FAKE_BIN}/systemctl" "${FAKE_BIN}/systemd-analyze"

HOME="${HOME_DIR}" \
XDG_CONFIG_HOME="${CONFIG_DIR}" \
TM_USER_SYSTEMD_WATCHDOG_STATE_DIR="${STATE_DIR}" \
TM_USER_SYSTEMD_BASELINE_FILE="${BASELINE_FILE}" \
TM_USER_SYSTEMD_SYSTEMCTL_BIN="${FAKE_BIN}/systemctl" \
TM_USER_SYSTEMD_INSTALL_TEST_SYSTEMCTL_LOG="${SYSTEMCTL_LOG}" \
TM_USER_SYSTEMD_INSTALL_TEST_ANALYZE_LOG="${ANALYZE_LOG}" \
PATH="${FAKE_BIN}:${PATH}" \
  "${SCRIPT_DIR}/install-user-systemd-unit-watchdog-timer.sh"

service_unit="${CONFIG_DIR}/systemd/user/traefik-manager-user-systemd-watchdog.service"
timer_unit="${CONFIG_DIR}/systemd/user/traefik-manager-user-systemd-watchdog.timer"
grep -Fxq "ConditionFileIsExecutable=${SCRIPT_DIR}/user-systemd-unit-watchdog.sh" "${service_unit}"
grep -Fxq "ConditionPathExists=${BASELINE_FILE}" "${service_unit}"
grep -Fxq "Environment=TM_USER_SYSTEMD_WATCHDOG_STATE_DIR=${STATE_DIR}" "${service_unit}"
grep -Fxq 'RestrictAddressFamilies=AF_UNIX' "${service_unit}"
grep -Fxq 'OnCalendar=*:11/15' "${timer_unit}"
grep -Fxq 'Persistent=true' "${timer_unit}"
grep -Fq -- '--user verify' "${ANALYZE_LOG}"
grep -Fq 'enable --now traefik-manager-user-systemd-watchdog.timer' "${SYSTEMCTL_LOG}"
[[ "$(wc -l < "${BASELINE_FILE}")" -eq 4 ]]
grep -Eq '^[a-f0-9]{64} timer traefik-manager-user-systemd-watchdog.timer$' "${BASELINE_FILE}"
grep -Eq '^[a-f0-9]{64} service traefik-manager-user-systemd-watchdog.service$' "${BASELINE_FILE}"
if grep -Fq 'start traefik-manager-user-systemd-watchdog.service' "${SYSTEMCTL_LOG}"; then
  echo "설치기가 watchdog service를 직접 실행했습니다" >&2
  exit 1
fi

echo "사용자 systemd watchdog timer 설치 self-test 통과"
