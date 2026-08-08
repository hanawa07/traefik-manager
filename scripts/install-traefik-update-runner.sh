#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly SCRIPT_DIR
readonly REPO_ROOT
readonly STATE_DIR="${TM_MANAGER_DEPLOY_STATE_DIR:-${XDG_STATE_HOME:-${HOME}/.local/state}/traefik-manager}"
readonly REQUEST_DIR="${TM_TRAEFIK_UPDATE_REQUEST_DIR:-${STATE_DIR}/traefik-update-requests}"
readonly TRAEFIK_DIR="${TM_TRAEFIK_UPDATE_COMPOSE_DIR:-${HOME}/docker/traefik}"
readonly TRAEFIK_COMPOSE_FILES="${TM_TRAEFIK_UPDATE_COMPOSE_FILES:-${TM_TRAEFIK_UPDATE_COMPOSE_FILE:-docker-compose.yml}}"
readonly TRAEFIK_ACME_FILE="${TM_TRAEFIK_UPDATE_ACME_FILE:-letsencrypt/acme.json}"
readonly TRAEFIK_SERVICE="${TM_TRAEFIK_UPDATE_SERVICE:-traefik}"
readonly TRAEFIK_CONTAINER="${TM_TRAEFIK_UPDATE_CONTAINER:-traefik}"
readonly TRAEFIK_NETWORK="${TM_TRAEFIK_UPDATE_NETWORK:-proxy_net}"
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

validate_relative_path() {
  local label="$1"
  local value="$2"
  [[ -n "${value}" && "${value}" != /* && "${value}" =~ ^[A-Za-z0-9_./-]+$ ]] \
    || { echo "${label} 경로가 올바르지 않습니다: ${value}" >&2; exit 2; }
  [[ "/${value}/" != *"/../"* ]] \
    || { echo "${label} 경로는 Traefik 디렉터리 내부여야 합니다" >&2; exit 2; }
}

validate_name() {
  local label="$1"
  local value="$2"
  [[ "${value}" =~ ^[A-Za-z0-9_.-]{1,100}$ ]] \
    || { echo "${label} 이름이 올바르지 않습니다: ${value}" >&2; exit 2; }
}

validate_compose_files() {
  local value="$1"
  local compose_file
  local -a compose_files
  local -A seen=()
  IFS=',' read -r -a compose_files <<< "${value}"
  [[ "${#compose_files[@]}" -gt 0 ]] \
    || { echo "Compose 파일 목록이 비어 있습니다" >&2; exit 2; }
  for compose_file in "${compose_files[@]}"; do
    validate_relative_path "Compose 파일" "${compose_file}"
    [[ -z "${seen[${compose_file}]+x}" ]] \
      || { echo "Compose 파일 목록에 중복 항목이 있습니다" >&2; exit 2; }
    seen["${compose_file}"]=1
  done
}

resolve_health_url() {
  local base_url="${TM_TRAEFIK_MANAGER_HEALTH_URL:-}"
  local key raw
  if [[ -z "${base_url}" && -f "${REPO_ROOT}/.env" ]]; then
    for key in TAILNET_FRONTEND_URL FRONTEND_DOMAIN; do
      raw="$(grep -E "^${key}=" "${REPO_ROOT}/.env" | tail -n 1 | cut -d= -f2- || true)"
      raw="${raw%$'\r'}"
      raw="${raw#\"}"
      raw="${raw%\"}"
      raw="${raw#\'}"
      raw="${raw%\'}"
      if [[ -n "${raw}" ]]; then
        base_url="${raw}"
        break
      fi
    done
  fi
  [[ -n "${base_url}" ]] || return 0
  if [[ "${base_url}" != http://* && "${base_url}" != https://* ]]; then
    base_url="https://${base_url}"
  fi
  base_url="${base_url%/}"
  if [[ "${base_url}" != */api/health ]]; then
    base_url="${base_url}/api/health"
  fi
  [[ "${base_url}" =~ ^https?://[A-Za-z0-9.-]+(:[1-9][0-9]{0,4})?/api/health$ ]] \
    || { echo "Manager health URL이 올바르지 않습니다" >&2; exit 2; }
  printf '%s\n' "${base_url}"
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
    printf 'Environment=TM_TRAEFIK_UPDATE_COMPOSE_FILES=%s\n' "${TRAEFIK_COMPOSE_FILES}"
    printf 'Environment=TM_TRAEFIK_UPDATE_ACME_FILE=%s\n' "${TRAEFIK_ACME_FILE}"
    printf 'Environment=TM_TRAEFIK_UPDATE_SERVICE=%s\n' "${TRAEFIK_SERVICE}"
    printf 'Environment=TM_TRAEFIK_UPDATE_CONTAINER=%s\n' "${TRAEFIK_CONTAINER}"
    printf 'Environment=TM_TRAEFIK_UPDATE_NETWORK=%s\n' "${TRAEFIK_NETWORK}"
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
validate_compose_files "${TRAEFIK_COMPOSE_FILES}"
validate_relative_path "ACME 파일" "${TRAEFIK_ACME_FILE}"
validate_name "Compose 서비스" "${TRAEFIK_SERVICE}"
validate_name "컨테이너" "${TRAEFIK_CONTAINER}"
validate_name "Docker 네트워크" "${TRAEFIK_NETWORK}"
[[ "${BACKEND_UID}" =~ ^[1-9][0-9]*$ ]] \
  || { echo "backend UID가 올바르지 않습니다: ${BACKEND_UID}" >&2; exit 2; }
command -v docker >/dev/null || { echo "docker 명령을 찾을 수 없습니다" >&2; exit 1; }
command -v setfacl >/dev/null || { echo "setfacl 명령이 필요합니다. 호스트에 acl 패키지를 설치하세요" >&2; exit 1; }
command -v systemctl >/dev/null || { echo "systemctl 명령을 찾을 수 없습니다" >&2; exit 1; }
IFS=',' read -r -a compose_files <<< "${TRAEFIK_COMPOSE_FILES}"
for compose_file in "${compose_files[@]}"; do
  [[ -f "${TRAEFIK_DIR}/${compose_file}" ]] \
    || { echo "Traefik Compose 파일을 찾을 수 없습니다: ${compose_file}" >&2; exit 1; }
done
[[ -f "${TRAEFIK_DIR}/${TRAEFIK_ACME_FILE}" && -s "${TRAEFIK_DIR}/${TRAEFIK_ACME_FILE}" ]] \
  || { echo "Traefik ACME 파일이 없거나 비어 있습니다: ${TRAEFIK_ACME_FILE}" >&2; exit 1; }

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
