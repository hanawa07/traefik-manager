#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly SCRIPT_DIR REPO_ROOT
readonly STATE_DIR="${TM_USER_SYSTEMD_WATCHDOG_STATE_DIR:-${XDG_STATE_HOME:-${HOME}/.local/state}/traefik-manager}"
readonly BASELINE_FILE="${TM_USER_SYSTEMD_BASELINE_FILE:-${STATE_DIR}/user-systemd-unit-baseline.sha256}"
readonly UNIT_DIR="${XDG_CONFIG_HOME:-${HOME}/.config}/systemd/user"
readonly SERVICE_NAME="traefik-manager-user-systemd-watchdog.service"
readonly TIMER_NAME="traefik-manager-user-systemd-watchdog.timer"
readonly WATCHDOG_SCRIPT="${SCRIPT_DIR}/user-systemd-unit-watchdog.sh"
readonly LOG_FILE="${STATE_DIR}/user-systemd-unit-watchdog.log"
readonly SYSTEMCTL_BIN="${TM_USER_SYSTEMD_SYSTEMCTL_BIN:-systemctl}"
temporary_dir="$(mktemp -d)"
trap 'rm -rf "${temporary_dir}"' EXIT

configure_user_bus() {
  local runtime_dir="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
  if [[ -z "${DBUS_SESSION_BUS_ADDRESS:-}" && -S "${runtime_dir}/bus" ]]; then
    export XDG_RUNTIME_DIR="${runtime_dir}"
    export DBUS_SESSION_BUS_ADDRESS="unix:path=${runtime_dir}/bus"
  fi
}

validate_path() {
  [[ "$2" =~ ^/[A-Za-z0-9_./-]+$ ]] \
    || { echo "$1 경로가 올바르지 않습니다: $2" >&2; exit 2; }
}

write_service_unit() {
  {
    printf '%s\n' '[Unit]'
    printf '%s\n' 'Description=Detect user systemd timer and service failures or configuration drift'
    printf 'ConditionFileIsExecutable=%s\n' "${WATCHDOG_SCRIPT}"
    printf 'ConditionPathExists=%s\n' "${BASELINE_FILE}"
    printf '%s\n' '' '[Service]'
    printf '%s\n' 'Type=oneshot'
    printf 'WorkingDirectory=%s\n' "${REPO_ROOT}"
    printf 'Environment=HOME=%s\n' "${HOME}"
    printf '%s\n' 'Environment=PATH=/usr/local/bin:/usr/bin:/bin'
    printf 'Environment=TM_USER_SYSTEMD_WATCHDOG_STATE_DIR=%s\n' "${STATE_DIR}"
    printf 'Environment=TM_USER_SYSTEMD_BASELINE_FILE=%s\n' "${BASELINE_FILE}"
    printf 'ExecStart=/usr/bin/bash %s\n' "${WATCHDOG_SCRIPT}"
    printf '%s\n' 'UMask=0022'
    printf '%s\n' 'NoNewPrivileges=yes'
    printf '%s\n' 'PrivateTmp=yes'
    printf '%s\n' 'RestrictAddressFamilies=AF_UNIX'
    printf '%s\n' 'LockPersonality=yes'
    printf '%s\n' 'TimeoutStartSec=1min'
    printf 'StandardOutput=append:%s\n' "${LOG_FILE}"
    printf 'StandardError=append:%s\n' "${LOG_FILE}"
  } > "$1"
}

write_timer_unit() {
  {
    printf '%s\n' '[Unit]'
    printf '%s\n' 'Description=Check user systemd timers and services every fifteen minutes'
    printf '%s\n' '' '[Timer]'
    printf '%s\n' 'OnCalendar=*:11/15'
    printf '%s\n' 'Persistent=true'
    printf '%s\n' 'AccuracySec=1min'
    printf 'Unit=%s\n' "${SERVICE_NAME}"
    printf '%s\n' '' '[Install]'
    printf '%s\n' 'WantedBy=timers.target'
  } > "$1"
}

for path_label in "저장소:${REPO_ROOT}" "스크립트:${SCRIPT_DIR}" "상태:${STATE_DIR}" \
  "기준선:${BASELINE_FILE}" "unit:${UNIT_DIR}"; do
  validate_path "${path_label%%:*}" "${path_label#*:}"
done
for command_name in install mktemp "${SYSTEMCTL_BIN}" systemd-analyze; do
  command -v "${command_name}" >/dev/null || {
    echo "필수 명령을 찾을 수 없습니다: ${command_name}" >&2
    exit 1
  }
done
[[ -x "${WATCHDOG_SCRIPT}" ]] || {
  echo "사용자 systemd watchdog 스크립트를 실행할 수 없습니다" >&2
  exit 1
}

service_unit="${temporary_dir}/${SERVICE_NAME}"
timer_unit="${temporary_dir}/${TIMER_NAME}"
verify_output="${temporary_dir}/systemd-verify.out"
write_service_unit "${service_unit}"
write_timer_unit "${timer_unit}"
if ! systemd-analyze --user verify "${service_unit}" "${timer_unit}" \
  > "${verify_output}" 2>&1; then
  cat "${verify_output}" >&2
  exit 1
fi
if [[ -s "${verify_output}" ]]; then
  cat "${verify_output}" >&2
  echo "systemd unit 검증 경고가 있어 설치를 중단합니다" >&2
  exit 1
fi

install -d -m 0755 "${STATE_DIR}" "${UNIT_DIR}"
install -m 0644 "${service_unit}" "${UNIT_DIR}/${SERVICE_NAME}"
install -m 0644 "${timer_unit}" "${UNIT_DIR}/${TIMER_NAME}"

configure_user_bus
"${SYSTEMCTL_BIN}" --user daemon-reload
"${SYSTEMCTL_BIN}" --user enable --now "${TIMER_NAME}"
"${SYSTEMCTL_BIN}" --user is-enabled --quiet "${TIMER_NAME}"
"${SYSTEMCTL_BIN}" --user is-active --quiet "${TIMER_NAME}"
TM_USER_SYSTEMD_WATCHDOG_STATE_DIR="${STATE_DIR}" \
TM_USER_SYSTEMD_BASELINE_FILE="${BASELINE_FILE}" \
TM_USER_SYSTEMD_SYSTEMCTL_BIN="${SYSTEMCTL_BIN}" \
  "${WATCHDOG_SCRIPT}" --write-baseline
grep -Eq "^[a-f0-9]{64} timer ${TIMER_NAME}$" "${BASELINE_FILE}"
grep -Eq "^[a-f0-9]{64} service ${SERVICE_NAME}$" "${BASELINE_FILE}"

echo "사용자 systemd timer·service watchdog 설치 완료"
