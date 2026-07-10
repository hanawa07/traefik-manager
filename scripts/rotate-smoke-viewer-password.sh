#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"
readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly SMOKE_USERNAME="${TM_SMOKE_USERNAME:-traefik-smoke-viewer}"

cd "${REPO_ROOT}"

for command_name in docker gh openssl; do
  command -v "${command_name}" >/dev/null || {
    echo "필수 명령을 찾을 수 없습니다: ${command_name}" >&2
    exit 1
  }
done

gh auth status >/dev/null
gh secret list --app actions >/dev/null

password="$(openssl rand -hex 32)"
trap 'unset password' EXIT

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

if [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
  export NVM_DIR="${HOME}/.nvm"
  # shellcheck disable=SC1091
  source "${NVM_DIR}/nvm.sh"
  nvm use --silent default >/dev/null
fi

if command -v node >/dev/null && [[ -f .env ]]; then
  # shellcheck disable=SC1091
  source .env
  TM_SMOKE_BASE_URL="${FRONTEND_DOMAIN:-}" \
    TM_SMOKE_USERNAME="${SMOKE_USERNAME}" \
    TM_SMOKE_PASSWORD="${password}" \
    node scripts/smoke-services-browser-session.mjs
else
  echo "Node.js 또는 .env가 없어 로컬 스모크 검증은 건너뜁니다"
fi

echo "스모크 viewer 비밀번호와 GitHub secret 회전 완료"
