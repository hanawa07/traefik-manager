#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR="$(mktemp -d)"
readonly SCRIPT_DIR TEMP_DIR
readonly FAKE_BIN="${TEMP_DIR}/bin"
readonly STATE_DIR="${TEMP_DIR}/state"
readonly MODE_FILE="${TEMP_DIR}/mode"
readonly ALERT_LOG="${TEMP_DIR}/alert.log"
readonly SYSTEMCTL_LOG="${TEMP_DIR}/systemctl.log"
readonly BASELINE_FILE="${STATE_DIR}/baseline.sha256"
trap 'rm -rf "${TEMP_DIR}"' EXIT

mkdir -p "${FAKE_BIN}" "${STATE_DIR}"
cat > "${FAKE_BIN}/systemctl" <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "${TM_USER_SYSTEMD_TEST_SYSTEMCTL_LOG}"
mode="$(<"${TM_USER_SYSTEMD_TEST_MODE_FILE}")"
case "${2:-}" in
  list-unit-files)
    if [[ "${mode}" != "timer-disabled" ]]; then
      printf '%s\n' 'sample.timer enabled enabled'
    fi
    printf '%s\n' 'traefik-manager-user-systemd-watchdog.timer enabled enabled'
    ;;
  show)
    unit="${3:-}"
    property=""
    for argument in "$@"; do
      [[ "${argument}" == --property=* ]] && property="${argument#--property=}"
    done
    case "${property}" in
      ActiveState)
        if [[ "${mode}" == "timer-disabled" && "${unit}" == "sample.timer" ]]; then
          printf '%s\n' inactive
        elif [[ "${mode}" == "service-failed" && "${unit}" == "sample.service" ]]; then
          printf '%s\n' failed
        elif [[ "${unit}" == *.timer ]]; then
          printf '%s\n' active
        else
          printf '%s\n' inactive
        fi
        ;;
      Triggers)
        printf '%s\n' "${unit%.timer}.service"
        ;;
      LoadState)
        printf '%s\n' loaded
        ;;
      Result)
        [[ "${mode}" == "service-failed" && "${unit}" == "sample.service" ]] \
          && printf '%s\n' exit-code || printf '%s\n' success
        ;;
      ExecMainStatus)
        [[ "${mode}" == "service-failed" && "${unit}" == "sample.service" ]] \
          && printf '%s\n' 1 || printf '%s\n' 0
        ;;
      *) exit 2 ;;
    esac
    ;;
  is-enabled)
    unit="${@: -1}"
    if [[ "${mode}" == "timer-disabled" && "${unit}" == "sample.timer" ]]; then
      printf '%s\n' disabled
      exit 1
    fi
    printf '%s\n' enabled
    ;;
  cat)
    unit="${3:-}"
    if [[ "${mode}" == "drift" && "${unit}" == "sample.service" ]]; then
      printf 'unit=%s;version=2\n' "${unit}"
    else
      printf 'unit=%s;version=1\n' "${unit}"
    fi
    ;;
  *) exit 2 ;;
esac
SCRIPT
cat > "${FAKE_BIN}/alert" <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\t%s\t%s\n' "$1" "$2" "$3" >> "${TM_USER_SYSTEMD_TEST_ALERT_LOG}"
SCRIPT
chmod 700 "${FAKE_BIN}/systemctl" "${FAKE_BIN}/alert"

run_watchdog() {
  local now="$1"
  TM_USER_SYSTEMD_WATCHDOG_STATE_DIR="${STATE_DIR}" \
  TM_USER_SYSTEMD_BASELINE_FILE="${BASELINE_FILE}" \
  TM_USER_SYSTEMD_SYSTEMCTL_BIN="${FAKE_BIN}/systemctl" \
  TM_USER_SYSTEMD_ALERT_SCRIPT="${FAKE_BIN}/alert" \
  TM_USER_SYSTEMD_FAILURE_THRESHOLD=2 \
  TM_USER_SYSTEMD_COOLDOWN_SECONDS=1000 \
  TM_USER_SYSTEMD_NOW_EPOCH="${now}" \
  TM_USER_SYSTEMD_TEST_MODE_FILE="${MODE_FILE}" \
  TM_USER_SYSTEMD_TEST_ALERT_LOG="${ALERT_LOG}" \
  TM_USER_SYSTEMD_TEST_SYSTEMCTL_LOG="${SYSTEMCTL_LOG}" \
    "${SCRIPT_DIR}/user-systemd-unit-watchdog.sh"
}

write_baseline() {
  TM_USER_SYSTEMD_WATCHDOG_STATE_DIR="${STATE_DIR}" \
  TM_USER_SYSTEMD_BASELINE_FILE="${BASELINE_FILE}" \
  TM_USER_SYSTEMD_SYSTEMCTL_BIN="${FAKE_BIN}/systemctl" \
  TM_USER_SYSTEMD_TEST_MODE_FILE="${MODE_FILE}" \
  TM_USER_SYSTEMD_TEST_SYSTEMCTL_LOG="${SYSTEMCTL_LOG}" \
    "${SCRIPT_DIR}/user-systemd-unit-watchdog.sh" --write-baseline
}

printf '%s' healthy > "${MODE_FILE}"
write_baseline
[[ "$(wc -l < "${BASELINE_FILE}")" -eq 4 ]]
grep -Eq '^[a-f0-9]{64} timer sample.timer$' "${BASELINE_FILE}"
grep -Eq '^[a-f0-9]{64} service sample.service$' "${BASELINE_FILE}"

run_watchdog 100
grep -Fxq 'status=healthy' "${STATE_DIR}/user-systemd-unit-watchdog.state"
[[ ! -s "${ALERT_LOG}" ]]

printf '%s' timer-disabled > "${MODE_FILE}"
run_watchdog 110
grep -Fxq 'consecutive_failures=1' "${STATE_DIR}/user-systemd-unit-watchdog.state"
[[ ! -s "${ALERT_LOG}" ]]
run_watchdog 120
[[ "$(wc -l < "${ALERT_LOG}")" -eq 1 ]]
grep -Fq 'timer-disabled:sample.timer' "${ALERT_LOG}"
run_watchdog 130
[[ "$(wc -l < "${ALERT_LOG}")" -eq 1 ]]

printf '%s' healthy > "${MODE_FILE}"
run_watchdog 140
[[ "$(wc -l < "${ALERT_LOG}")" -eq 2 ]]
grep -Fq $'\trecovery' "${ALERT_LOG}"

rm -f "${STATE_DIR}/user-systemd-unit-watchdog.state"
printf '%s' service-failed > "${MODE_FILE}"
run_watchdog 200
run_watchdog 210
grep -Fq 'service-failed:sample.service' "${ALERT_LOG}"

rm -f "${STATE_DIR}/user-systemd-unit-watchdog.state"
printf '%s' drift > "${MODE_FILE}"
run_watchdog 300
run_watchdog 310
grep -Fq 'unit-drift:sample.service' "${ALERT_LOG}"
[[ "$(stat --format='%a' "${STATE_DIR}/user-systemd-unit-watchdog.state")" == "644" ]]

echo "사용자 systemd timer·service watchdog 통합 시험 통과"
