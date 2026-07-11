#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"
readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly SMOKE_USERNAME="${TM_SMOKE_USERNAME:-traefik-smoke-viewer}"
readonly ROTATION_STATE_DIR="${XDG_STATE_HOME:-${HOME}/.local/state}/traefik-manager"
readonly ROTATION_LOCK_FILE="${ROTATION_STATE_DIR}/smoke-password-rotation.lock"
rotation_step="초기화"

cd "${REPO_ROOT}"

report_rotation_status() {
  local status="$1"
  local detail="${2:-}"
  TM_SMOKE_ROTATION_STATUS="${status}" TM_SMOKE_ROTATION_DETAIL="${detail}" \
    docker compose exec -T \
      -e TM_SMOKE_ROTATION_STATUS \
      -e TM_SMOKE_ROTATION_DETAIL \
      backend python -m app.interfaces.cli.smoke_rotation_reporter
}

handle_exit() {
  local exit_code=$?
  trap - EXIT
  if (( exit_code != 0 )); then
    report_rotation_status failure "${rotation_step}" || \
      echo "회전 실패 상태와 운영 알림을 기록하지 못했습니다: ${rotation_step}" >&2
  fi
  unset password
  exit "${exit_code}"
}

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
  echo "스모크 viewer 비밀번호 회전이 이미 실행 중이므로 건너뜁니다"
  exit 0
fi

rotation_step="GitHub 인증 확인"
gh auth status >/dev/null
gh secret list --app actions >/dev/null

rotation_step="회전 시작 상태 기록"
report_rotation_status running "회전을 시작했습니다"

rotation_step="임시 비밀번호 생성"
password="$(openssl rand -hex 32)"

rotation_step="viewer 계정 갱신"
TM_CI_PASSWORD="${password}" TM_SMOKE_USERNAME="${SMOKE_USERNAME}" \
  docker compose exec -T -e TM_CI_PASSWORD -e TM_SMOKE_USERNAME backend python - <<'PY'
import json
import os
from http.cookiejar import CookieJar
from urllib.parse import urlencode
from urllib.request import HTTPCookieProcessor, Request, build_opener

from app.core.config import settings

base_url = "http://127.0.0.1:8000/api/v1"
username = os.environ.get("TM_SMOKE_USERNAME", "traefik-smoke-viewer")
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
        "User-Agent": "TraefikManagerSmokeRotation/1.0",
    },
)
with opener.open(login_request) as response:
    response.read()

cookie_values = {cookie.name: cookie.value for cookie in cookies}
headers = {
    "Content-Type": "application/json",
    "Cookie": "; ".join(f"{key}={value}" for key, value in cookie_values.items()),
    "User-Agent": "TraefikManagerSmokeRotation/1.0",
    "X-CSRF-Token": cookie_values[settings.SESSION_CSRF_COOKIE_NAME],
}
with opener.open(Request(f"{base_url}/users", headers=headers)) as response:
    users = json.loads(response.read()).get("users", [])

existing = next((user for user in users if user["username"] == username), None)
payload = {
    "username": username,
    "password": password,
    "role": "viewer",
    "is_active": True,
}
target_url = f"{base_url}/users/{existing['id']}" if existing else f"{base_url}/users"
method = "PUT" if existing else "POST"
with opener.open(
    Request(
        target_url,
        data=json.dumps(payload).encode(),
        headers=headers,
        method=method,
    )
) as response:
    user = json.loads(response.read())

if user["role"] != "viewer" or not user["is_active"]:
    raise RuntimeError("스모크 viewer 계정 상태가 올바르지 않습니다")
print("스모크 viewer 계정 비밀번호 갱신 완료")
PY

rotation_step="GitHub secret 갱신"
secret_updated=false
for attempt in 1 2 3; do
  if printf %s "${password}" | gh secret set TM_SMOKE_PASSWORD --app actions; then
    secret_updated=true
    break
  fi
  echo "GitHub secret 갱신 재시도: ${attempt}/3" >&2
  sleep 5
done

if [[ "${secret_updated}" != "true" ]]; then
  echo "GitHub secret 갱신 실패: 스크립트를 즉시 다시 실행해야 합니다" >&2
  exit 1
fi

rotation_step="Node.js 실행 환경 준비"
if [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
  export NVM_DIR="${HOME}/.nvm"
  # shellcheck disable=SC1091
  source "${NVM_DIR}/nvm.sh"
  nvm use --silent default >/dev/null
fi

rotation_step="회전 후 인증 스모크 검증"
if command -v node >/dev/null && [[ -f .env ]]; then
  # shellcheck disable=SC1091
  source .env
  TM_SMOKE_BASE_URL="${FRONTEND_DOMAIN:-}" \
    TM_SMOKE_USERNAME="${SMOKE_USERNAME}" \
    TM_SMOKE_PASSWORD="${password}" \
    node scripts/smoke-services-browser-session.mjs
else
  echo "Node.js 또는 .env가 없어 로컬 스모크 검증을 실행할 수 없습니다" >&2
  exit 1
fi

rotation_step="성공 상태 기록"
report_rotation_status success
echo "스모크 viewer 비밀번호와 GitHub secret 회전 완료"
