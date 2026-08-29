#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR="$(mktemp -d)"
readonly SCRIPT_DIR TEMP_DIR
readonly UNIT_DIR="${TEMP_DIR}/units"
readonly STATE_DIR="${TEMP_DIR}/state"
readonly BASELINE_FILE="${STATE_DIR}/baseline.sha256"
readonly SYSTEMCTL_BIN="${TEMP_DIR}/systemctl"
readonly WATCHDOG_BIN="${TEMP_DIR}/watchdog"
readonly SYSTEMCTL_LOG="${TEMP_DIR}/systemctl.log"
trap 'rm -rf -- "${TEMP_DIR}"' EXIT

mkdir -p "${UNIT_DIR}" "${STATE_DIR}/enabled" "${STATE_DIR}/active"
cat > "${SYSTEMCTL_BIN}" <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "${TM_UNINSTALL_TEST_SYSTEMCTL_LOG}"
[[ "$1" == --user ]]
shift
command_name="$1"
shift
case "${command_name}" in
  show)
    unit="$1"
    property=""
    for argument in "$@"; do
      [[ "${argument}" == --property=* ]] && property="${argument#--property=}"
    done
    case "${property}" in
      Triggers)
        [[ "${unit}" == sample.timer || "${unit}" == sample.path ]] \
          && printf '%s\n' sample.service
        ;;
      TriggeredBy) [[ "${unit}" == sample.service ]] && printf '%s\n' 'sample.timer sample.path' ;;
      LoadState)
        [[ -e "${TM_UNINSTALL_TEST_UNIT_DIR}/${unit}" ]] \
          && printf '%s\n' loaded || printf '%s\n' not-found
        ;;
      *) exit 2 ;;
    esac
    ;;
  is-enabled|is-active)
    [[ "${1:-}" == --quiet ]] && shift
    state_name="${command_name#is-}"
    [[ -e "${TM_UNINSTALL_TEST_STATE_DIR}/${state_name}/$1" ]]
    ;;
  stop|disable|start|enable)
    state_name="${command_name}"
    [[ "${command_name}" == stop ]] && state_name=active
    [[ "${command_name}" == disable ]] && state_name=enabled
    [[ "${command_name}" == start ]] && state_name=active
    [[ "${command_name}" == enable ]] && state_name=enabled
    for unit in "$@"; do
      if [[ "${command_name}" == stop || "${command_name}" == disable ]]; then
        rm -f -- "${TM_UNINSTALL_TEST_STATE_DIR}/${state_name}/${unit}"
      else
        : > "${TM_UNINSTALL_TEST_STATE_DIR}/${state_name}/${unit}"
      fi
    done
    ;;
  daemon-reload) ;;
  *) exit 2 ;;
esac
SCRIPT
cat > "${WATCHDOG_BIN}" <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
[[ "$1" == --retire-baseline ]]
shift
[[ "$*" == 'sample.timer sample.service' ]]
if [[ "${TM_UNINSTALL_TEST_RETIRE_FAIL:-0}" == 1 ]]; then
  printf '%s\n' broken > "${TM_USER_SYSTEMD_BASELINE_FILE}"
  exit 1
fi
grep -vE ' (timer sample\.timer|service sample\.service)$' \
  "${TM_USER_SYSTEMD_BASELINE_FILE}" > "${TM_USER_SYSTEMD_BASELINE_FILE}.new"
mv "${TM_USER_SYSTEMD_BASELINE_FILE}.new" "${TM_USER_SYSTEMD_BASELINE_FILE}"
SCRIPT
chmod 700 "${SYSTEMCTL_BIN}" "${WATCHDOG_BIN}"

reset_fixture() {
  rm -rf -- "${UNIT_DIR}" "${STATE_DIR}/enabled" "${STATE_DIR}/active"
  mkdir -p "${UNIT_DIR}" "${STATE_DIR}/enabled" "${STATE_DIR}/active"
  printf '%s\n' timer > "${UNIT_DIR}/sample.timer"
  printf '%s\n' path > "${UNIT_DIR}/sample.path"
  printf '%s\n' service > "${UNIT_DIR}/sample.service"
  : > "${STATE_DIR}/enabled/sample.timer"
  : > "${STATE_DIR}/active/sample.timer"
  : > "${STATE_DIR}/enabled/sample.path"
  : > "${STATE_DIR}/active/sample.path"
  {
    printf '%064d timer keep.timer\n' 0
    printf '%064d service keep.service\n' 0
    printf '%064d timer sample.timer\n' 1
    printf '%064d service sample.service\n' 1
  } > "${BASELINE_FILE}"
  : > "${SYSTEMCTL_LOG}"
}

run_uninstaller() {
  TM_USER_SYSTEMD_UNIT_DIR="${UNIT_DIR}" \
  TM_USER_SYSTEMD_WATCHDOG_STATE_DIR="${STATE_DIR}" \
  TM_USER_SYSTEMD_BASELINE_FILE="${BASELINE_FILE}" \
  TM_USER_SYSTEMD_WATCHDOG_SCRIPT="${WATCHDOG_BIN}" \
  TM_USER_SYSTEMD_SYSTEMCTL_BIN="${SYSTEMCTL_BIN}" \
  TM_UNINSTALL_TEST_UNIT_DIR="${UNIT_DIR}" \
  TM_UNINSTALL_TEST_STATE_DIR="${STATE_DIR}" \
  TM_UNINSTALL_TEST_SYSTEMCTL_LOG="${SYSTEMCTL_LOG}" \
  TM_UNINSTALL_TEST_RETIRE_FAIL="${TM_UNINSTALL_TEST_RETIRE_FAIL:-0}" \
    "${SCRIPT_DIR}/uninstall-user-systemd-units.sh" \
      --confirm=REMOVE sample.timer sample.path sample.service
}

reset_fixture
run_uninstaller
for unit in sample.timer sample.path sample.service; do
  [[ ! -e "${UNIT_DIR}/${unit}" ]]
done
[[ ! -e "${STATE_DIR}/enabled/sample.timer" && ! -e "${STATE_DIR}/active/sample.path" ]]
[[ "$(wc -l < "${BASELINE_FILE}")" -eq 2 ]]
grep -Fq -- '--user stop sample.timer sample.path' "${SYSTEMCTL_LOG}"
grep -Fq -- '--user daemon-reload' "${SYSTEMCTL_LOG}"

reset_fixture
cp "${BASELINE_FILE}" "${TEMP_DIR}/baseline.before-failure"
set +e
TM_UNINSTALL_TEST_RETIRE_FAIL=1 run_uninstaller > "${TEMP_DIR}/failure.out" 2>&1
failure_status=$?
set -e
[[ "${failure_status}" -ne 0 ]]
cmp "${TEMP_DIR}/baseline.before-failure" "${BASELINE_FILE}"
for unit in sample.timer sample.path sample.service; do
  [[ -e "${UNIT_DIR}/${unit}" ]]
done
[[ -e "${STATE_DIR}/enabled/sample.timer" && -e "${STATE_DIR}/active/sample.path" ]]
grep -Fq '기존 unit 상태를 복구합니다' "${TEMP_DIR}/failure.out"

reset_fixture
set +e
TM_USER_SYSTEMD_UNIT_DIR="${UNIT_DIR}" \
TM_USER_SYSTEMD_WATCHDOG_STATE_DIR="${STATE_DIR}" \
TM_USER_SYSTEMD_BASELINE_FILE="${BASELINE_FILE}" \
TM_USER_SYSTEMD_WATCHDOG_SCRIPT="${WATCHDOG_BIN}" \
TM_USER_SYSTEMD_SYSTEMCTL_BIN="${SYSTEMCTL_BIN}" \
TM_UNINSTALL_TEST_UNIT_DIR="${UNIT_DIR}" \
TM_UNINSTALL_TEST_STATE_DIR="${STATE_DIR}" \
TM_UNINSTALL_TEST_SYSTEMCTL_LOG="${SYSTEMCTL_LOG}" \
  "${SCRIPT_DIR}/uninstall-user-systemd-units.sh" \
    --confirm=REMOVE sample.timer sample.service > "${TEMP_DIR}/incomplete.out" 2>&1
incomplete_status=$?
set -e
[[ "${incomplete_status}" -ne 0 ]]
grep -Fq '함께 제거하지 않은 service 실행 주체가 있습니다' "${TEMP_DIR}/incomplete.out"
[[ -e "${UNIT_DIR}/sample.timer" && -e "${UNIT_DIR}/sample.service" ]]

echo "사용자 systemd unit 안전 제거 self-test 통과"
