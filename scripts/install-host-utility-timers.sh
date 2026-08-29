#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly SCRIPT_DIR REPO_ROOT
readonly UNIT_SOURCE_DIR="${REPO_ROOT}/deploy/systemd-user"
readonly UNIT_DIR="${XDG_CONFIG_HOME:-${HOME}/.config}/systemd/user"
readonly STATE_DIR="${TM_USER_SYSTEMD_WATCHDOG_STATE_DIR:-${XDG_STATE_HOME:-${HOME}/.local/state}/traefik-manager}"
readonly USER_SYSTEMD_WATCHDOG_SCRIPT="${TM_USER_SYSTEMD_WATCHDOG_SCRIPT:-${SCRIPT_DIR}/user-systemd-unit-watchdog.sh}"
readonly -a AVAILABLE_TARGETS=(
  docker-dns-probe
  nvme-life-alert
  openclaw-postboot-healthcheck
)
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
  [[ "$2" =~ ^/[A-Za-z0-9_./-]+$ ]] || {
    echo "$1 경로가 올바르지 않습니다: $2" >&2
    exit 2
  }
}

for item in "저장소:${REPO_ROOT}" "unit 원본:${UNIT_SOURCE_DIR}" "unit:${UNIT_DIR}" \
  "상태:${STATE_DIR}" "기준선 갱신:${USER_SYSTEMD_WATCHDOG_SCRIPT}"; do
  validate_path "${item%%:*}" "${item#*:}"
done
for command_name in install mktemp systemctl systemd-analyze; do
  command -v "${command_name}" >/dev/null || {
    echo "필수 명령을 찾을 수 없습니다: ${command_name}" >&2
    exit 1
  }
done
[[ -x "${USER_SYSTEMD_WATCHDOG_SCRIPT}" ]] || {
  echo "사용자 systemd 감시 스크립트를 실행할 수 없습니다" >&2
  exit 1
}

targets=("$@")
[[ "${#targets[@]}" -gt 0 ]] || targets=("${AVAILABLE_TARGETS[@]}")
declare -A selected=()
unit_paths=()
unit_names=()
timer_names=()
for target in "${targets[@]}"; do
  case "${target}" in
    docker-dns-probe|nvme-life-alert|openclaw-postboot-healthcheck) ;;
    *)
      echo "지원하지 않는 호스트 timer입니다: ${target}" >&2
      exit 2
      ;;
  esac
  [[ -z "${selected[${target}]+x}" ]] || {
    echo "호스트 timer가 중복 지정되었습니다: ${target}" >&2
    exit 2
  }
  [[ -x "${SCRIPT_DIR}/${target}.sh" ]] || {
    echo "호스트 점검 스크립트를 실행할 수 없습니다: ${target}" >&2
    exit 1
  }
  selected["${target}"]=1
  service_name="${target}.service"
  timer_name="${target}.timer"
  unit_paths+=("${UNIT_SOURCE_DIR}/${service_name}" "${UNIT_SOURCE_DIR}/${timer_name}")
  unit_names+=("${timer_name}" "${service_name}")
  timer_names+=("${timer_name}")
done

verify_output="${temporary_dir}/systemd-verify.out"
if ! systemd-analyze --user verify "${unit_paths[@]}" > "${verify_output}" 2>&1; then
  cat "${verify_output}" >&2
  exit 1
fi
if [[ -s "${verify_output}" ]]; then
  cat "${verify_output}" >&2
  echo "systemd unit 검증 경고가 있어 설치를 중단합니다" >&2
  exit 1
fi

install -d -m 0755 "${STATE_DIR}" "${UNIT_DIR}"
for unit_path in "${unit_paths[@]}"; do
  install -m 0644 "${unit_path}" "${UNIT_DIR}/${unit_path##*/}"
done
configure_user_bus
systemctl --user daemon-reload
for timer_name in "${timer_names[@]}"; do
  systemctl --user enable --now "${timer_name}"
  systemctl --user is-enabled --quiet "${timer_name}"
  systemctl --user is-active --quiet "${timer_name}"
done
TM_USER_SYSTEMD_WATCHDOG_STATE_DIR="${STATE_DIR}" \
  "${USER_SYSTEMD_WATCHDOG_SCRIPT}" --refresh-baseline "${unit_names[@]}"
echo "호스트 utility timer 설치 완료 (${#timer_names[@]}개)"
