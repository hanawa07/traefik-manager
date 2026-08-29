#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly SCRIPT_DIR REPO_ROOT
readonly STATE_DIR="${TM_TCG_STOREFRONT_STATE_DIR:-${XDG_STATE_HOME:-${HOME}/.local/state}/traefik-manager}"
readonly UNIT_DIR="${XDG_CONFIG_HOME:-${HOME}/.config}/systemd/user"
readonly SERVICE_NAME="traefik-manager-tcg-storefront-watchdog.service"
readonly TIMER_NAME="traefik-manager-tcg-storefront-watchdog.timer"
readonly LOG_FILE="${STATE_DIR}/tcg-storefront-watchdog.log"
readonly USER_SYSTEMD_WATCHDOG_SCRIPT="${TM_USER_SYSTEMD_WATCHDOG_SCRIPT:-${SCRIPT_DIR}/user-systemd-unit-watchdog.sh}"
readonly USER_SYSTEMD_TRANSACTION_LIB="${TM_USER_SYSTEMD_TRANSACTION_LIB:-${SCRIPT_DIR}/lib/user-systemd-unit-transaction.sh}"
temporary_dir="$(mktemp -d)"

finish_install() {
  local exit_status=$?
  trap - EXIT
  set +e
  if declare -F tm_finish_user_systemd_unit_transaction >/dev/null; then
    tm_finish_user_systemd_unit_transaction "${exit_status}"
    exit_status=$?
  fi
  rm -rf "${temporary_dir}"
  exit "${exit_status}"
}
trap finish_install EXIT

configure_user_bus() {
  local runtime_dir="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
  if [[ -z "${DBUS_SESSION_BUS_ADDRESS:-}" && -S "${runtime_dir}/bus" ]]; then
    export XDG_RUNTIME_DIR="${runtime_dir}"
    export DBUS_SESSION_BUS_ADDRESS="unix:path=${runtime_dir}/bus"
  fi
}

validate_path() {
  [[ "$2" =~ ^/[A-Za-z0-9_./-]+$ ]] || {
    echo "$1 경로가 올바르지 않습니다: $2" >&2
    exit 2
  }
}

write_service_unit() {
  local target="$1"
  {
    printf '%s\n' '[Unit]'
    printf '%s\n' 'Description=Check TCG storefront purchase and social login entry points'
    printf 'ConditionFileIsExecutable=%s/tcg-storefront-watchdog.sh\n' "${SCRIPT_DIR}"
    printf '%s\n' '' '[Service]'
    printf '%s\n' 'Type=oneshot'
    printf 'WorkingDirectory=%s\n' "${REPO_ROOT}"
    printf 'Environment=HOME=%s\n' "${HOME}"
    printf '%s\n' 'Environment=PATH=/usr/local/bin:/usr/bin:/bin'
    printf 'Environment=TM_TCG_STOREFRONT_STATE_DIR=%s\n' "${STATE_DIR}"
    printf 'ExecStart=/usr/bin/bash %s/tcg-storefront-watchdog.sh\n' "${SCRIPT_DIR}"
    printf '%s\n' 'UMask=0022'
    printf '%s\n' 'NoNewPrivileges=yes'
    printf '%s\n' 'PrivateTmp=yes'
    printf '%s\n' 'RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6'
    printf '%s\n' 'LockPersonality=yes'
    printf '%s\n' 'TimeoutStartSec=2min'
    printf 'StandardOutput=append:%s\n' "${LOG_FILE}"
    printf 'StandardError=append:%s\n' "${LOG_FILE}"
  } > "${target}"
}

write_timer_unit() {
  local target="$1"
  {
    printf '%s\n' '[Unit]'
    printf '%s\n' 'Description=Check TCG storefront every fifteen minutes'
    printf '%s\n' '' '[Timer]'
    printf '%s\n' 'OnCalendar=*:0/15'
    printf '%s\n' 'AccuracySec=1min'
    printf '%s\n' 'Persistent=true'
    printf 'Unit=%s\n' "${SERVICE_NAME}"
    printf '%s\n' '' '[Install]'
    printf '%s\n' 'WantedBy=timers.target'
  } > "${target}"
}

for item in "저장소:${REPO_ROOT}" "스크립트:${SCRIPT_DIR}" "상태:${STATE_DIR}" \
  "unit:${UNIT_DIR}" "기준선 갱신:${USER_SYSTEMD_WATCHDOG_SCRIPT}" \
  "unit 트랜잭션:${USER_SYSTEMD_TRANSACTION_LIB}"; do
  validate_path "${item%%:*}" "${item#*:}"
done
for command_name in install mktemp systemctl systemd-analyze; do
  command -v "${command_name}" >/dev/null || {
    echo "필수 명령을 찾을 수 없습니다: ${command_name}" >&2
    exit 1
  }
done
for script_name in tcg-storefront-watchdog.sh tcg-storefront-probe.mjs request-host-operation-alert.sh; do
  [[ -x "${SCRIPT_DIR}/${script_name}" ]] || {
    echo "실행 가능한 스크립트를 찾을 수 없습니다: ${script_name}" >&2
    exit 1
  }
done
[[ -x "${USER_SYSTEMD_WATCHDOG_SCRIPT}" ]] || {
  echo "사용자 systemd 기준선 갱신 스크립트를 실행할 수 없습니다" >&2
  exit 1
}
[[ -r "${USER_SYSTEMD_TRANSACTION_LIB}" ]] || {
  echo "사용자 systemd unit 트랜잭션을 읽을 수 없습니다" >&2
  exit 1
}
# shellcheck source=lib/user-systemd-unit-transaction.sh
source "${USER_SYSTEMD_TRANSACTION_LIB}"

service_unit="${temporary_dir}/${SERVICE_NAME}"
timer_unit="${temporary_dir}/${TIMER_NAME}"
verify_output="${temporary_dir}/systemd-verify.out"
write_service_unit "${service_unit}"
write_timer_unit "${timer_unit}"
if ! systemd-analyze --user verify "${service_unit}" "${timer_unit}" > "${verify_output}" 2>&1; then
  cat "${verify_output}" >&2
  exit 1
fi
if [[ -s "${verify_output}" ]]; then
  cat "${verify_output}" >&2
  echo "systemd unit 검증 경고가 있어 설치를 중단합니다" >&2
  exit 1
fi

configure_user_bus
transaction_backup="${temporary_dir}/unit-transaction"
tm_begin_user_systemd_unit_transaction "${transaction_backup}" "${UNIT_DIR}" \
  "${TIMER_NAME}" "${SERVICE_NAME}"
install -d -m 0755 "${STATE_DIR}" "${UNIT_DIR}"
install -m 0644 "${service_unit}" "${UNIT_DIR}/${SERVICE_NAME}"
install -m 0644 "${timer_unit}" "${UNIT_DIR}/${TIMER_NAME}"
systemctl --user daemon-reload
systemctl --user enable --now "${TIMER_NAME}"
systemctl --user is-enabled --quiet "${TIMER_NAME}"
systemctl --user is-active --quiet "${TIMER_NAME}"
TM_USER_SYSTEMD_WATCHDOG_STATE_DIR="${TM_USER_SYSTEMD_WATCHDOG_STATE_DIR:-${STATE_DIR}}" \
  "${USER_SYSTEMD_WATCHDOG_SCRIPT}" --refresh-baseline "${TIMER_NAME}" "${SERVICE_NAME}"
tm_commit_user_systemd_unit_transaction
echo "TCG storefront 외부 watchdog timer 설치 완료"
