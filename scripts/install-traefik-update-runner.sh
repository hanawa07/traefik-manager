#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly SCRIPT_DIR
readonly REPO_ROOT
readonly STATE_DIR="${TM_MANAGER_DEPLOY_STATE_DIR:-${XDG_STATE_HOME:-${HOME}/.local/state}/traefik-manager}"
readonly REQUEST_DIR="${TM_TRAEFIK_UPDATE_REQUEST_DIR:-${STATE_DIR}/traefik-update-requests}"
readonly TRAEFIK_DIR="${TM_TRAEFIK_UPDATE_COMPOSE_DIR:-${HOME}/docker/traefik}"
readonly UNIT_DIR="${XDG_CONFIG_HOME:-${HOME}/.config}/systemd/user"
readonly SERVICE_NAME="traefik-manager-traefik-update.service"
readonly PATH_NAME="traefik-manager-traefik-update.path"
readonly TIMER_NAME="traefik-manager-traefik-update.timer"
readonly BACKEND_UID="${TM_TRAEFIK_UPDATE_BACKEND_UID:-10001}"

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

resolve_health_url() {
  local domain=""
  if [[ -f "${REPO_ROOT}/.env" ]]; then
    domain="$(awk -F= '$1 == "FRONTEND_DOMAIN" {print $2; exit}' "${REPO_ROOT}/.env")"
  fi
  if [[ "${domain}" =~ ^[A-Za-z0-9.-]+$ ]]; then
    printf 'https://%s/api/health\n' "${domain}"
  fi
}

prepare_request_dir() {
  install -d -m 0700 "${REQUEST_DIR}"
  setfacl --remove-all "${REQUEST_DIR}"
  setfacl --remove-default "${REQUEST_DIR}"
  chmod 0700 "${REQUEST_DIR}"
  setfacl --modify "u:${BACKEND_UID}:rwx,g::---,m::rwx,o::---" "${REQUEST_DIR}"
}

write_service_unit() {
  local health_url="$1"
  {
    printf '%s\n' '[Unit]'
    printf '%s\n' 'Description=Traefik Manager safe patch update runner'
    printf '%s\n' 'After=docker.service network-online.target'
    printf '%s\n' '' '[Service]'
    printf '%s\n' 'Type=oneshot'
    printf 'Environment=TM_MANAGER_DEPLOY_STATE_DIR=%s\n' "${STATE_DIR}"
    printf 'Environment=TM_TRAEFIK_UPDATE_REQUEST_DIR=%s\n' "${REQUEST_DIR}"
    printf 'Environment=TM_TRAEFIK_UPDATE_COMPOSE_DIR=%s\n' "${TRAEFIK_DIR}"
    if [[ -n "${health_url}" ]]; then
      printf 'Environment=TM_TRAEFIK_MANAGER_HEALTH_URL=%s\n' "${health_url}"
    fi
    printf 'ExecStart=%s/traefik-update-runner.py\n' "${SCRIPT_DIR}"
    printf '%s\n' 'NoNewPrivileges=yes'
    printf '%s\n' 'PrivateTmp=yes'
    printf '%s\n' 'ProtectSystem=strict'
    printf '%s\n' 'ProtectHome=read-only'
    printf 'ReadWritePaths=%s %s /var/run/docker.sock\n' "${STATE_DIR}" "${TRAEFIK_DIR}"
    printf '%s\n' 'RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6'
    printf '%s\n' 'LockPersonality=yes'
  } > "${UNIT_DIR}/${SERVICE_NAME}"
}

write_path_unit() {
  {
    printf '%s\n' '[Unit]'
    printf '%s\n' 'Description=Watch Traefik Manager patch update requests'
    printf '%s\n' '' '[Path]'
    printf 'PathChanged=%s\n' "${REQUEST_DIR}"
    printf 'Unit=%s\n' "${SERVICE_NAME}"
    printf '%s\n' '' '[Install]'
    printf '%s\n' 'WantedBy=default.target'
  } > "${UNIT_DIR}/${PATH_NAME}"
}

write_timer_unit() {
  {
    printf '%s\n' '[Unit]'
    printf '%s\n' 'Description=Refresh Traefik Manager update runner heartbeat'
    printf '%s\n' '' '[Timer]'
    printf '%s\n' 'OnBootSec=30s'
    printf '%s\n' 'OnUnitInactiveSec=60s'
    printf 'Unit=%s\n' "${SERVICE_NAME}"
    printf '%s\n' '' '[Install]'
    printf '%s\n' 'WantedBy=timers.target'
  } > "${UNIT_DIR}/${TIMER_NAME}"
}

validate_path "저장소" "${REPO_ROOT}"
validate_path "상태" "${STATE_DIR}"
validate_path "요청" "${REQUEST_DIR}"
validate_path "Traefik" "${TRAEFIK_DIR}"
[[ "${BACKEND_UID}" =~ ^[1-9][0-9]*$ ]] \
  || { echo "backend UID가 올바르지 않습니다: ${BACKEND_UID}" >&2; exit 2; }
command -v docker >/dev/null || { echo "docker 명령을 찾을 수 없습니다" >&2; exit 1; }
command -v setfacl >/dev/null || { echo "setfacl 명령이 필요합니다. 호스트에 acl 패키지를 설치하세요" >&2; exit 1; }
command -v systemctl >/dev/null || { echo "systemctl 명령을 찾을 수 없습니다" >&2; exit 1; }
[[ -f "${TRAEFIK_DIR}/docker-compose.yml" ]] \
  || { echo "Traefik Compose 파일을 찾을 수 없습니다" >&2; exit 1; }

install -d -m 0755 "${STATE_DIR}" "${UNIT_DIR}"
prepare_request_dir
configure_user_bus
health_url="$(resolve_health_url)"
write_service_unit "${health_url}"
write_path_unit
write_timer_unit
systemctl --user daemon-reload
systemctl --user enable --now "${PATH_NAME}" "${TIMER_NAME}"
systemctl --user start "${SERVICE_NAME}"
service_result="$(systemctl --user show "${SERVICE_NAME}" --property=Result --value)"
[[ "${service_result}" == "success" ]] \
  || { echo "Traefik 업데이트 실행기 시작 실패: ${service_result}" >&2; exit 1; }
echo "Traefik 안전 업데이트 실행기 설치 완료"
