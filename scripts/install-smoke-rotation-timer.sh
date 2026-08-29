#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly SCRIPT_DIR
readonly REPO_ROOT
readonly STATE_DIR="${TM_MANAGER_DEPLOY_STATE_DIR:-${XDG_STATE_HOME:-${HOME}/.local/state}/traefik-manager}"
readonly UNIT_DIR="${XDG_CONFIG_HOME:-${HOME}/.config}/systemd/user"
readonly TIMER_DATA_DIR="${XDG_DATA_HOME:-${HOME}/.local/share}/systemd/timers"
readonly SERVICE_NAME="traefik-manager-smoke-rotation.service"
readonly TIMER_NAME="traefik-manager-smoke-rotation.timer"
readonly TIMER_STAMP="${TIMER_DATA_DIR}/stamp-${TIMER_NAME}"
readonly LOG_FILE="${STATE_DIR}/smoke-password-rotation.log"
readonly USER_SYSTEMD_WATCHDOG_SCRIPT="${TM_USER_SYSTEMD_WATCHDOG_SCRIPT:-${SCRIPT_DIR}/user-systemd-unit-watchdog.sh}"
readonly SCHEDULE="*-*-01 04:17:00 Asia/Seoul"
readonly CRON_BEGIN="# BEGIN TRAEFIK_MANAGER_SMOKE_ROTATION"
readonly CRON_END="# END TRAEFIK_MANAGER_SMOKE_ROTATION"
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
  local label="$1"
  local value="$2"
  [[ "${value}" =~ ^/[A-Za-z0-9_./-]+$ ]] \
    || { echo "${label} 경로가 올바르지 않습니다: ${value}" >&2; exit 2; }
}

write_service_unit() {
  local target="$1"
  {
    printf '%s\n' '[Unit]'
    printf '%s\n' 'Description=Rotate Traefik Manager smoke account passwords'
    printf 'ConditionFileIsExecutable=%s/rotate-smoke-viewer-password.sh\n' "${SCRIPT_DIR}"
    printf '%s\n' '' '[Service]'
    printf '%s\n' 'Type=oneshot'
    printf 'WorkingDirectory=%s\n' "${REPO_ROOT}"
    printf 'Environment=HOME=%s\n' "${HOME}"
    printf '%s\n' 'Environment=PATH=/usr/local/bin:/usr/bin:/bin'
    printf 'ExecStart=/usr/bin/bash %s/rotate-smoke-viewer-password.sh\n' "${SCRIPT_DIR}"
    # User-service mount namespaces disable the installed Chrome SUID sandbox.
    printf '%s\n' 'UMask=0077'
    printf '%s\n' 'RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6'
    printf '%s\n' 'LockPersonality=yes'
    printf '%s\n' 'TimeoutStartSec=20min'
    printf 'StandardOutput=append:%s\n' "${LOG_FILE}"
    printf 'StandardError=append:%s\n' "${LOG_FILE}"
  } > "${target}"
}

write_timer_unit() {
  local target="$1"
  {
    printf '%s\n' '[Unit]'
    printf '%s\n' 'Description=Rotate Traefik Manager smoke accounts monthly'
    printf '%s\n' '' '[Timer]'
    printf 'OnCalendar=%s\n' "${SCHEDULE}"
    printf '%s\n' 'Persistent=true'
    printf '%s\n' 'AccuracySec=1min'
    printf 'Unit=%s\n' "${SERVICE_NAME}"
    printf '%s\n' '' '[Install]'
    printf '%s\n' 'WantedBy=timers.target'
  } > "${target}"
}

seed_timer_stamp() {
  [[ -e "${TIMER_STAMP}" ]] && return
  install -m 0640 /dev/null "${TIMER_STAMP}"
}

remove_legacy_cron_block() {
  local current_cron="${temporary_dir}/current.cron"
  local cron_error="${temporary_dir}/cron.error"
  local filtered_cron="${temporary_dir}/filtered.cron"
  local begin_count end_count

  if ! crontab -l > "${current_cron}" 2> "${cron_error}"; then
    if [[ ! -s "${current_cron}" ]] && grep -Fqi 'no crontab' "${cron_error}"; then
      return
    fi
    cat "${cron_error}" >&2
    return 1
  fi

  begin_count="$(awk -v marker="${CRON_BEGIN}" '$0 == marker { count += 1 } END { print count + 0 }' "${current_cron}")"
  end_count="$(awk -v marker="${CRON_END}" '$0 == marker { count += 1 } END { print count + 0 }' "${current_cron}")"
  if [[ "${begin_count}" == "0" && "${end_count}" == "0" ]]; then
    return
  fi
  if [[ "${begin_count}" != "1" || "${end_count}" != "1" ]]; then
    echo "기존 smoke rotation cron 마커 쌍이 올바르지 않습니다" >&2
    return 1
  fi

  awk -v begin="${CRON_BEGIN}" -v end="${CRON_END}" '
    $0 == begin {
      if (inside) exit 41
      inside = 1
      next
    }
    $0 == end {
      if (!inside) exit 42
      inside = 0
      next
    }
    !inside { print }
    END { if (inside) exit 43 }
  ' "${current_cron}" > "${filtered_cron}"
  crontab "${filtered_cron}"
}

for path_label in "저장소:${REPO_ROOT}" "스크립트:${SCRIPT_DIR}" "상태:${STATE_DIR}" \
  "unit:${UNIT_DIR}" "timer 상태:${TIMER_DATA_DIR}" \
  "기준선 갱신:${USER_SYSTEMD_WATCHDOG_SCRIPT}"; do
  validate_path "${path_label%%:*}" "${path_label#*:}"
done
for command_name in awk crontab grep install mktemp systemctl systemd-analyze; do
  command -v "${command_name}" >/dev/null || {
    echo "필수 명령을 찾을 수 없습니다: ${command_name}" >&2
    exit 1
  }
done
[[ -x "${SCRIPT_DIR}/rotate-smoke-viewer-password.sh" ]] || {
  echo "스모크 계정 회전 스크립트를 실행할 수 없습니다" >&2
  exit 1
}
[[ -x "${USER_SYSTEMD_WATCHDOG_SCRIPT}" ]] || {
  echo "사용자 systemd 기준선 갱신 스크립트를 실행할 수 없습니다" >&2
  exit 1
}
systemd-analyze calendar "${SCHEDULE}" >/dev/null

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

install -d -m 0755 "${STATE_DIR}" "${UNIT_DIR}" "${TIMER_DATA_DIR}"
install -m 0644 "${service_unit}" "${UNIT_DIR}/${SERVICE_NAME}"
install -m 0644 "${timer_unit}" "${UNIT_DIR}/${TIMER_NAME}"
seed_timer_stamp

configure_user_bus
systemctl --user daemon-reload
systemctl --user enable --now "${TIMER_NAME}"
systemctl --user is-enabled --quiet "${TIMER_NAME}"
systemctl --user is-active --quiet "${TIMER_NAME}"
remove_legacy_cron_block
TM_USER_SYSTEMD_WATCHDOG_STATE_DIR="${TM_USER_SYSTEMD_WATCHDOG_STATE_DIR:-${STATE_DIR}}" \
  "${USER_SYSTEMD_WATCHDOG_SCRIPT}" --refresh-baseline "${TIMER_NAME}" "${SERVICE_NAME}"

echo "Traefik Manager 월간 스모크 계정 회전 timer 설치 완료"
