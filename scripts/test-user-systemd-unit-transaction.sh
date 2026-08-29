#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR="$(mktemp -d)"
readonly SCRIPT_DIR TEMP_DIR
readonly UNIT_DIR="${TEMP_DIR}/units"
readonly BACKUP_DIR="${TEMP_DIR}/backup"
readonly FAILURE_BACKUP_DIR="${TEMP_DIR}/failure-backup"
readonly COMMIT_BACKUP_DIR="${TEMP_DIR}/commit-backup"
readonly UNCOMMITTED_BACKUP_DIR="${TEMP_DIR}/uncommitted-backup"
readonly STATE_DIR="${TEMP_DIR}/state"
readonly SYSTEMCTL_LOG="${TEMP_DIR}/systemctl.log"
readonly SYSTEMCTL_BIN="${TEMP_DIR}/systemctl"
trap 'rm -rf "${TEMP_DIR}"' EXIT

mkdir -p "${UNIT_DIR}" "${STATE_DIR}/enabled" "${STATE_DIR}/active"
cat > "${SYSTEMCTL_BIN}" <<'SCRIPT'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "${TM_TRANSACTION_TEST_SYSTEMCTL_LOG}"
[[ "$1" == --user ]]
shift
command_name="$1"
shift
case "${command_name}" in
  is-enabled)
    [[ "${1:-}" == --quiet ]] && shift
    [[ -e "${TM_TRANSACTION_TEST_STATE_DIR}/enabled/$1" ]]
    ;;
  is-active)
    [[ "${1:-}" == --quiet ]] && shift
    [[ -e "${TM_TRANSACTION_TEST_STATE_DIR}/active/$1" ]]
    ;;
  enable)
    : > "${TM_TRANSACTION_TEST_STATE_DIR}/enabled/$1"
    ;;
  disable)
    rm -f "${TM_TRANSACTION_TEST_STATE_DIR}/enabled/$1"
    ;;
  start)
    : > "${TM_TRANSACTION_TEST_STATE_DIR}/active/$1"
    ;;
  stop)
    rm -f "${TM_TRANSACTION_TEST_STATE_DIR}/active/$1"
    ;;
  daemon-reload) ;;
  *) exit 2 ;;
esac
SCRIPT
chmod 700 "${SYSTEMCTL_BIN}"

printf '%s\n' 'original service' > "${UNIT_DIR}/sample.service"
printf '%s\n' 'original timer target' > "${UNIT_DIR}/sample.timer.target"
ln -s "${UNIT_DIR}/sample.timer.target" "${UNIT_DIR}/sample.timer"
: > "${STATE_DIR}/enabled/sample.timer"
: > "${STATE_DIR}/active/sample.timer"

# shellcheck source=lib/user-systemd-unit-transaction.sh
source "${SCRIPT_DIR}/lib/user-systemd-unit-transaction.sh"
export TM_USER_SYSTEMD_TRANSACTION_SYSTEMCTL_BIN="${SYSTEMCTL_BIN}"
export TM_TRANSACTION_TEST_SYSTEMCTL_LOG="${SYSTEMCTL_LOG}"
export TM_TRANSACTION_TEST_STATE_DIR="${STATE_DIR}"

tm_snapshot_user_systemd_units "${BACKUP_DIR}" "${UNIT_DIR}" \
  sample.timer sample.service new.timer new.service

printf '%s\n' 'changed service' > "${UNIT_DIR}/sample.service"
rm -f "${UNIT_DIR}/sample.timer"
printf '%s\n' 'changed timer' > "${UNIT_DIR}/sample.timer"
printf '%s\n' 'new service' > "${UNIT_DIR}/new.service"
printf '%s\n' 'new timer' > "${UNIT_DIR}/new.timer"
rm -f "${STATE_DIR}/enabled/sample.timer" "${STATE_DIR}/active/sample.timer"
: > "${STATE_DIR}/enabled/new.timer"
: > "${STATE_DIR}/active/new.timer"

tm_rollback_user_systemd_units "${BACKUP_DIR}" "${UNIT_DIR}"

grep -Fxq 'original service' "${UNIT_DIR}/sample.service"
[[ -L "${UNIT_DIR}/sample.timer" ]]
[[ "$(readlink "${UNIT_DIR}/sample.timer")" == "${UNIT_DIR}/sample.timer.target" ]]
[[ ! -e "${UNIT_DIR}/new.service" && ! -L "${UNIT_DIR}/new.service" ]]
[[ ! -e "${UNIT_DIR}/new.timer" && ! -L "${UNIT_DIR}/new.timer" ]]
[[ -e "${STATE_DIR}/enabled/sample.timer" && -e "${STATE_DIR}/active/sample.timer" ]]
[[ ! -e "${STATE_DIR}/enabled/new.timer" && ! -e "${STATE_DIR}/active/new.timer" ]]
grep -Fq -- '--user daemon-reload' "${SYSTEMCTL_LOG}"
if tm_snapshot_user_systemd_units "${TEMP_DIR}/invalid" "${UNIT_DIR}" '../bad.service'; then
  echo "잘못된 unit 이름이 허용되었습니다" >&2
  exit 1
fi

tm_begin_user_systemd_unit_transaction "${FAILURE_BACKUP_DIR}" "${UNIT_DIR}" \
  sample.timer sample.service new.timer new.service
printf '%s\n' 'failed service change' > "${UNIT_DIR}/sample.service"
printf '%s\n' 'failed new service' > "${UNIT_DIR}/new.service"
printf '%s\n' 'failed new timer' > "${UNIT_DIR}/new.timer"
unset TM_USER_SYSTEMD_TRANSACTION_SYSTEMCTL_BIN
set +e
tm_finish_user_systemd_unit_transaction 37 > "${TEMP_DIR}/failure-finish.out" 2>&1
finish_status=$?
set -e
[[ "${finish_status}" == 37 ]]
grep -Fxq 'original service' "${UNIT_DIR}/sample.service"
[[ ! -e "${UNIT_DIR}/new.service" && ! -e "${UNIT_DIR}/new.timer" ]]
grep -Fq '기존 unit 상태를 복구합니다' "${TEMP_DIR}/failure-finish.out"

export TM_USER_SYSTEMD_TRANSACTION_SYSTEMCTL_BIN="${SYSTEMCTL_BIN}"
tm_begin_user_systemd_unit_transaction "${COMMIT_BACKUP_DIR}" "${UNIT_DIR}" \
  sample.timer sample.service
printf '%s\n' 'committed service' > "${UNIT_DIR}/sample.service"
tm_commit_user_systemd_unit_transaction
tm_finish_user_systemd_unit_transaction 0
grep -Fxq 'committed service' "${UNIT_DIR}/sample.service"

tm_begin_user_systemd_unit_transaction "${UNCOMMITTED_BACKUP_DIR}" "${UNIT_DIR}" \
  sample.timer sample.service
printf '%s\n' 'uncommitted service' > "${UNIT_DIR}/sample.service"
set +e
tm_finish_user_systemd_unit_transaction 0 > "${TEMP_DIR}/uncommitted-finish.out" 2>&1
finish_status=$?
set -e
[[ "${finish_status}" == 1 ]]
grep -Fxq 'committed service' "${UNIT_DIR}/sample.service"
grep -Fq '커밋되지 않은 사용자 systemd 설치를 복구했습니다' \
  "${TEMP_DIR}/uncommitted-finish.out"

echo "user systemd unit 트랜잭션 self-test 통과"
