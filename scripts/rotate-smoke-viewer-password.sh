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
backend_service=""
viewer_password=""
admin_password=""
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
    docker compose exec -T \
      -e TM_SMOKE_ROTATION_STATUS \
      -e TM_SMOKE_ROTATION_DETAIL \
      "${backend_service}" python -m app.interfaces.cli.smoke_rotation_reporter
}

request_external_failure_alert() {
  gh workflow run host-operation-alert.yml \
    --ref main \
    -f source="스모크 계정 비밀번호 회전" \
    -f detail="$1"
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
      "${backend_service}" python - <<'PY'
import json
import os
from http.cookiejar import CookieJar
from urllib.parse import urlencode
from urllib.request import HTTPCookieProcessor, Request, build_opener

from app.core.config import settings

base_url = "http://127.0.0.1:8000/api/v1"
username = os.environ["TM_SMOKE_ACCOUNT_USERNAME"]
role = os.environ["TM_SMOKE_ACCOUNT_ROLE"]
password = os.environ["TM_CI_PASSWORD"]
cookies = CookieJar()
opener = build_opener(HTTPCookieProcessor(cookies))

login_request = Request(
    f"{base_url}/auth/login",
    data=urlencode(
        {"username": settings.ADMIN_USERNAME, "password": settings.ADMIN_PASSWORD}
    ).encode(),
    headers={
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "TraefikManagerSmokeRotation/2.0",
    },
)
with opener.open(login_request) as response:
    response.read()

cookie_values = {cookie.name: cookie.value for cookie in cookies}
headers = {
    "Content-Type": "application/json",
    "Cookie": "; ".join(f"{key}={value}" for key, value in cookie_values.items()),
    "User-Agent": "TraefikManagerSmokeRotation/2.0",
    "X-CSRF-Token": cookie_values[settings.SESSION_CSRF_COOKIE_NAME],
}
with opener.open(Request(f"{base_url}/users", headers=headers)) as response:
    users = json.loads(response.read()).get("users", [])

existing = next((user for user in users if user["username"] == username), None)
payload = {
    "username": username,
    "password": password,
    "role": role,
    "is_active": True,
}
target_url = f"{base_url}/users/{existing['id']}" if existing else f"{base_url}/users"
with opener.open(
    Request(
        target_url,
        data=json.dumps(payload).encode(),
        headers=headers,
        method="PUT" if existing else "POST",
    )
) as response:
    user = json.loads(response.read())

if user["username"] != username or user["role"] != role or not user["is_active"]:
    raise RuntimeError(f"스모크 {role} 계정 상태가 올바르지 않습니다")
print(f"스모크 {role} 계정 비밀번호 갱신 완료")
PY
}

set_github_secret() {
  local name="$1"
  local value="$2"
  local attempt
  for attempt in 1 2 3; do
    if printf %s "${value}" | gh secret set "${name}" --app actions; then
      return
    fi
    echo "GitHub secret 갱신 재시도: ${name} ${attempt}/3" >&2
    sleep 5
  done
  echo "GitHub secret 갱신 실패: ${name}" >&2
  return 1
}

rotate_github_secret() {
  local name="$1"
  rotation_step="GitHub secret 갱신: ${name}"
  set_github_secret "${name}" "$2"
}

run_self_test() {
  local attempt_count attempts_file route_file temp_dir
  temp_dir="$(mktemp -d)"
  route_file="${temp_dir}/route.yml"
  attempts_file="${temp_dir}/secret-attempts"
  trap 'rm -rf "${temp_dir}"' RETURN
  printf 'url: "http://traefik-manager-frontend-green:3000"\n' >"${route_file}"
  [[ "$(resolve_backend_service "${route_file}")" == "backend-green" ]]
  printf 'url: "http://traefik-manager-frontend-blue:3000"\n' >"${route_file}"
  [[ "$(resolve_backend_service "${route_file}")" == "backend-blue" ]]
  printf 'url: "http://traefik-manager-frontend:3000"\n' >"${route_file}"
  [[ "$(resolve_backend_service "${route_file}")" == "backend" ]]

  gh() {
    local attempt=0
    if [[ -f "${attempts_file}" ]]; then
      read -r attempt <"${attempts_file}"
    fi
    attempt=$((attempt + 1))
    printf '%s\n' "${attempt}" >"${attempts_file}"
    cat >/dev/null
    (( attempt > 3 ))
  }
  sleep() { :; }

  if set_github_secret TM_SMOKE_PASSWORD first-attempt >/dev/null 2>&1; then
    echo "GitHub secret 3회 실패를 감지하지 못했습니다" >&2
    return 1
  fi
  rotate_github_secret TM_SMOKE_PASSWORD recovery-attempt >/dev/null 2>&1
  read -r attempt_count <"${attempts_file}"
  [[ "${attempt_count}" == "4" ]]
  [[ "${rotation_step}" == "GitHub secret 갱신: TM_SMOKE_PASSWORD" ]]
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

for command_name in docker flock gh openssl; do
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

rotation_step="GitHub 인증 확인"
gh auth status >/dev/null
gh secret list --app actions >/dev/null

rotation_step="활성 backend 확인"
backend_service="$(resolve_backend_service)"

rotation_step="회전 시작 상태 기록"
report_rotation_status running "회전을 시작했습니다"

rotation_step="임시 비밀번호 생성"
viewer_password="$(openssl rand -hex 32)"
admin_password="$(openssl rand -hex 32)"

rotation_step="viewer 계정 갱신"
update_account "${VIEWER_USERNAME}" viewer "${viewer_password}"
rotate_github_secret TM_SMOKE_USERNAME "${VIEWER_USERNAME}"
rotate_github_secret TM_SMOKE_PASSWORD "${viewer_password}"

rotation_step="admin 계정 갱신"
update_account "${SMOKE_ADMIN_USERNAME}" admin "${admin_password}"
rotate_github_secret TM_SMOKE_ADMIN_USERNAME "${SMOKE_ADMIN_USERNAME}"
rotate_github_secret TM_SMOKE_ADMIN_PASSWORD "${admin_password}"

rotation_step="Node.js 실행 환경 준비"
if [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
  export NVM_DIR="${HOME}/.nvm"
  # shellcheck disable=SC1091
  source "${NVM_DIR}/nvm.sh"
  nvm use --silent default >/dev/null
fi

rotation_step="회전 후 viewer·admin 스모크 검증"
base_url="$(read_env_value FRONTEND_DOMAIN)"
if command -v node >/dev/null && [[ -n "${base_url}" ]]; then
  TM_SMOKE_BASE_URL="${base_url}" \
    TM_SMOKE_USERNAME="${VIEWER_USERNAME}" \
    TM_SMOKE_PASSWORD="${viewer_password}" \
    TM_SMOKE_ADMIN_USERNAME="${SMOKE_ADMIN_USERNAME}" \
    TM_SMOKE_ADMIN_PASSWORD="${admin_password}" \
    TM_SMOKE_ADMIN_EXPECT_READ_ONLY=1 \
    node scripts/smoke-services-browser-session.mjs
else
  echo "Node.js 또는 .env의 FRONTEND_DOMAIN이 없어 로컬 스모크 검증을 실행할 수 없습니다" >&2
  exit 1
fi

rotation_step="성공 상태 기록"
report_rotation_status success
echo "스모크 viewer·admin 비밀번호와 GitHub secret 회전 완료"
