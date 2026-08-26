#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly REPO_ROOT
readonly ROUTE_FILE="${REPO_ROOT}/traefik-config/dynamic/traefik-manager-self.yml"
readonly VIEWER_USERNAME="${TM_SMOKE_USERNAME:-traefik-smoke-viewer}"
readonly SMOKE_ADMIN_USERNAME="${TM_SMOKE_ADMIN_USERNAME:-traefik-smoke-admin}"
readonly ROTATION_STATE_DIR="${XDG_STATE_HOME:-${HOME}/.local/state}/traefik-manager"
readonly ROTATION_LOCK_FILE="${ROTATION_STATE_DIR}/smoke-password-rotation.lock"
readonly DEPLOYMENT_STATE_FILE="${ROTATION_STATE_DIR}/blue-green-deployment.state"
readonly HOST_ALERT_SCRIPT="${TM_HOST_OPERATION_ALERT_SCRIPT:-${SCRIPT_DIR}/request-host-operation-alert.sh}"
backend_service=""
viewer_password=""
admin_password=""
smoke_revision=""
smoke_started_at=""
rotation_step="초기화"

cd "${REPO_ROOT}"

resolve_backend_service() {
  local route_file="${1:-${ROUTE_FILE}}"
  if grep -Fq 'url: "http://traefik-manager-frontend-green:3000"' "${route_file}" 2>/dev/null; then
    printf 'backend-green\n'
    return
  fi
  if grep -Fq 'url: "http://traefik-manager-frontend-blue:3000"' "${route_file}" 2>/dev/null; then
    printf 'backend-blue\n'
    return
  fi
  if grep -Fq 'url: "http://traefik-manager-frontend:3000"' "${route_file}" 2>/dev/null; then
    printf 'backend\n'
    return
  fi

  local running service
  local -a matches=()
  running="$(docker compose ps --services --status running)"
  for service in backend-green backend-blue backend; do
    if grep -Fxq "${service}" <<<"${running}"; then
      matches+=("${service}")
    fi
  done
  if (( ${#matches[@]} != 1 )); then
    echo "활성 backend 서비스를 하나로 결정할 수 없습니다" >&2
    return 1
  fi
  printf '%s\n' "${matches[0]}"
}

read_env_value() {
  local key="$1"
  local raw
  raw="$(grep -E "^${key}=" "${REPO_ROOT}/.env" 2>/dev/null | tail -n 1 | cut -d= -f2- || true)"
  raw="${raw%$'\r'}"
  raw="${raw#\"}"
  raw="${raw%\"}"
  raw="${raw#\'}"
  raw="${raw%\'}"
  printf '%s\n' "${raw}"
}

report_rotation_status() {
  local status="$1"
  local detail="${2:-}"
  [[ -n "${backend_service}" ]] || return 1
  TM_SMOKE_ROTATION_STATUS="${status}" TM_SMOKE_ROTATION_DETAIL="${detail}" \
    TM_SMOKE_ROTATION_REVISION="${smoke_revision}" \
    TM_SMOKE_ROTATION_STARTED_AT="${smoke_started_at}" \
    docker compose exec -T \
      -e TM_SMOKE_ROTATION_STATUS \
      -e TM_SMOKE_ROTATION_DETAIL \
      -e TM_SMOKE_ROTATION_REVISION \
      -e TM_SMOKE_ROTATION_STARTED_AT \
      "${backend_service}" python -m app.interfaces.cli.smoke_rotation_reporter
}

is_revision() {
  [[ "${1:-}" =~ ^[0-9a-f]{7,40}$ ]]
}

read_active_container_revision() {
  local container_id=""
  local revision=""
  [[ -n "${backend_service}" ]] || return 1
  container_id="$(docker compose ps -q "${backend_service}" 2>/dev/null | head -n 1)"
  [[ -n "${container_id}" ]] || return 1

  revision="$(docker inspect --format \
    '{{ index .Config.Labels "org.opencontainers.image.revision" }}' \
    "${container_id}" 2>/dev/null || true)"
  revision="${revision,,}"
  if is_revision "${revision}"; then
    printf '%s\n' "${revision}"
    return
  fi

  revision="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' \
    "${container_id}" 2>/dev/null \
    | awk -F= '$1 == "TRAEFIK_MANAGER_GIT_SHA" {print $2; exit}' || true)"
  revision="${revision,,}"
  is_revision "${revision}" || return 1
  printf '%s\n' "${revision}"
}

select_deployed_revision() {
  local state_revision="${1,,}"
  local container_revision="${2,,}"
  if is_revision "${container_revision}"; then
    if is_revision "${state_revision}" \
      && [[ "${state_revision}" != "${container_revision}"* \
        && "${container_revision}" != "${state_revision}"* ]]; then
      echo "배포 상태 파일과 활성 backend revision이 달라 활성 컨테이너 값을 사용합니다: state=${state_revision:0:12}, active=${container_revision:0:12}" >&2
    fi
    printf '%s\n' "${container_revision}"
    return
  fi
  if is_revision "${state_revision}"; then
    printf '%s\n' "${state_revision}"
    return
  fi
  echo "활성 backend 이미지와 배포 상태 파일에서 revision을 확인하지 못했습니다" >&2
  return 1
}

resolve_deployed_revision() {
  local state_revision=""
  local container_revision=""
  if [[ -f "${DEPLOYMENT_STATE_FILE}" ]]; then
    state_revision="$(awk -F= '$1 == "revision" {print $2; exit}' "${DEPLOYMENT_STATE_FILE}")"
  fi
  container_revision="$(read_active_container_revision || true)"
  select_deployed_revision "${state_revision}" "${container_revision}"
}

request_external_failure_alert() {
  "${HOST_ALERT_SCRIPT}" "스모크 계정 비밀번호 회전" "$1" failure >/dev/null
}

update_account() {
  local username="$1"
  local role="$2"
  local password="$3"
  TM_CI_PASSWORD="${password}" TM_SMOKE_ACCOUNT_USERNAME="${username}" TM_SMOKE_ACCOUNT_ROLE="${role}" \
    docker compose exec -T \
      -e TM_CI_PASSWORD \
      -e TM_SMOKE_ACCOUNT_USERNAME \
      -e TM_SMOKE_ACCOUNT_ROLE \
      "${backend_service}" python -m app.interfaces.cli.smoke_account_updater
}

run_self_test() {
  local route_file state_file state_revision temp_dir
  temp_dir="$(mktemp -d)"
  route_file="${temp_dir}/route.yml"
  state_file="${temp_dir}/deployment.state"
  trap 'rm -rf "${temp_dir}"' RETURN
  printf 'url: "http://traefik-manager-frontend-green:3000"\n' >"${route_file}"
  [[ "$(resolve_backend_service "${route_file}")" == "backend-green" ]]
  printf 'url: "http://traefik-manager-frontend-blue:3000"\n' >"${route_file}"
  [[ "$(resolve_backend_service "${route_file}")" == "backend-blue" ]]
  printf 'url: "http://traefik-manager-frontend:3000"\n' >"${route_file}"
  [[ "$(resolve_backend_service "${route_file}")" == "backend" ]]
  printf 'slot=blue\nrevision=ABCDEF1234567\n' >"${state_file}"
  state_revision="$(awk -F= '$1 == "revision" {print $2; exit}' "${state_file}")"
  [[ "$(select_deployed_revision "${state_revision}" 'not-a-revision')" == "abcdef1234567" ]]
  [[ "$(select_deployed_revision 'abcdef1234567' '1234567abcdef' 2>"${temp_dir}/mismatch-warning")" == "1234567abcdef" ]]
  grep -Fq '활성 컨테이너 값을 사용합니다' "${temp_dir}/mismatch-warning"
  [[ "$(select_deployed_revision 'not-a-revision' '1234567abcdef')" == "1234567abcdef" ]]
  [[ "$(select_deployed_revision 'abcdef1' 'abcdef1234567890' 2>"${temp_dir}/prefix-warning")" == "abcdef1234567890" ]]
  [[ ! -s "${temp_dir}/prefix-warning" ]]
  if select_deployed_revision 'not-a-revision' '' >/dev/null 2>&1; then
    echo "유효하지 않은 revision이 선택됐습니다" >&2
    return 1
  fi
  echo "스모크 계정 회전 self-test 통과"
}

handle_exit() {
  local exit_code=$?
  trap - EXIT
  if (( exit_code != 0 )); then
    if ! report_rotation_status failure "${rotation_step}"; then
      request_external_failure_alert "${rotation_step}" || \
        echo "내부·외부 회전 실패 알림을 모두 전송하지 못했습니다: ${rotation_step}" >&2
    fi
  fi
  unset viewer_password admin_password
  exit "${exit_code}"
}

if [[ "${1:-}" == "--self-test" ]]; then
  run_self_test
  exit 0
fi

trap handle_exit EXIT

for command_name in awk date docker flock openssl; do
  command -v "${command_name}" >/dev/null || {
    echo "필수 명령을 찾을 수 없습니다: ${command_name}" >&2
    exit 1
  }
done

rotation_step="중복 실행 잠금 획득"
mkdir -p "${ROTATION_STATE_DIR}"
exec 9>"${ROTATION_LOCK_FILE}"
if ! flock -n 9; then
  echo "스모크 계정 비밀번호 회전이 이미 실행 중이므로 건너뜁니다"
  exit 0
fi

rotation_step="활성 backend 확인"
backend_service="$(resolve_backend_service)"

rotation_step="배포 커밋 확인"
smoke_revision="$(resolve_deployed_revision)"
smoke_started_at="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"

rotation_step="회전 시작 상태 기록"
report_rotation_status running "회전을 시작했습니다"

rotation_step="임시 비밀번호 생성"
viewer_password="$(openssl rand -hex 32)"
admin_password="$(openssl rand -hex 32)"

rotation_step="viewer 계정 갱신"
update_account "${VIEWER_USERNAME}" viewer "${viewer_password}"

rotation_step="admin 계정 갱신"
update_account "${SMOKE_ADMIN_USERNAME}" admin "${admin_password}"

rotation_step="Node.js 실행 환경 준비"
if [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
  export NVM_DIR="${HOME}/.nvm"
  # shellcheck disable=SC1091
  source "${NVM_DIR}/nvm.sh"
  nvm use --silent default >/dev/null
fi

rotation_step="회전 후 viewer·admin 스모크 검증"
base_url="${TM_SMOKE_BASE_URL:-}"
if [[ -z "${base_url}" ]]; then
  base_url="$(read_env_value TAILNET_FRONTEND_URL)"
fi
if [[ -z "${base_url}" ]]; then
  base_url="$(read_env_value FRONTEND_DOMAIN)"
fi
if command -v node >/dev/null && [[ -n "${base_url}" ]]; then
  TM_SMOKE_BASE_URL="${base_url}" \
    TM_SMOKE_USERNAME="${VIEWER_USERNAME}" \
    TM_SMOKE_PASSWORD="${viewer_password}" \
    TM_SMOKE_ADMIN_USERNAME="${SMOKE_ADMIN_USERNAME}" \
    TM_SMOKE_ADMIN_PASSWORD="${admin_password}" \
    TM_SMOKE_ADMIN_EXPECT_READ_ONLY=1 \
    "${SCRIPT_DIR}/check-services.sh"
else
  echo "Node.js 또는 .env의 TAILNET_FRONTEND_URL/FRONTEND_DOMAIN이 없어 로컬 스모크 검증을 실행할 수 없습니다" >&2
  exit 1
fi

rotation_step="성공 상태 기록"
report_rotation_status success
echo "스모크 viewer·admin 비밀번호 회전과 로컬 검증 완료"
