#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
readonly STATE_DIR="${TM_MANAGER_DEPLOY_STATE_DIR:-${XDG_STATE_HOME:-${HOME}/.local/state}/traefik-manager}"
readonly TRAEFIK_DIR="${TM_TRAEFIK_UPDATE_COMPOSE_DIR:-${HOME}/docker/traefik}"
readonly COMPOSE_FILES="${TM_TRAEFIK_UPDATE_COMPOSE_FILES:-${TM_TRAEFIK_UPDATE_COMPOSE_FILE:-docker-compose.yml}}"
readonly SERVICE="${TM_TRAEFIK_UPDATE_SERVICE:-traefik}"
readonly CONTAINER="${TM_TRAEFIK_UPDATE_CONTAINER:-traefik}"
readonly DOCKER_BIN="${TM_TRAEFIK_UPDATE_DOCKER_BIN:-docker}"

compose_up_arguments=(-d)
if [[ "${1:-}" == "--force-recreate" && "$#" -eq 1 ]]; then
  compose_up_arguments+=(--force-recreate)
elif [[ "$#" -ne 0 ]]; then
  echo "사용법: $0 [--force-recreate]" >&2
  exit 2
fi

[[ "${SERVICE}" =~ ^[A-Za-z0-9_.-]{1,100}$ ]] \
  || { echo "Compose 서비스 이름이 올바르지 않습니다" >&2; exit 2; }
IFS=',' read -r -a compose_files <<< "${COMPOSE_FILES}"
compose_command=("${DOCKER_BIN}" compose)
for compose_file in "${compose_files[@]}"; do
  [[ -n "${compose_file}" && "${compose_file}" != /* && "/${compose_file}/" != *"/../"* ]] \
    || { echo "Compose 파일 경로가 올바르지 않습니다" >&2; exit 2; }
  [[ -f "${TRAEFIK_DIR}/${compose_file}" ]] \
    || { echo "Traefik Compose 파일을 찾을 수 없습니다: ${compose_file}" >&2; exit 1; }
  compose_command+=(-f "${TRAEFIK_DIR}/${compose_file}")
done

"${SCRIPT_DIR}/traefik_recreate_window.py"
mkdir -p "${STATE_DIR}"
exec 9>> "${STATE_DIR}/traefik-update-runner.lock"
flock -n 9 || { echo "다른 Traefik 업데이트 작업이 실행 중입니다" >&2; exit 1; }
previous_container_id="$("${DOCKER_BIN}" inspect --format '{{.Id}}' "${CONTAINER}")"
compose_status=0
"${compose_command[@]}" up "${compose_up_arguments[@]}" "${SERVICE}" || compose_status=$?
audit_status=0
"${SCRIPT_DIR}/traefik_recreate_audit.py" \
  "${previous_container_id}" manual_safe --actor "${USER:-host}" \
  || audit_status=$?
[[ "${compose_status}" -eq 0 ]] || exit "${compose_status}"
exit "${audit_status}"
