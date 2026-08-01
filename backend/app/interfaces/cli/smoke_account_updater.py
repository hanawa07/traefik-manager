import json
import os
from http.cookiejar import CookieJar
from urllib.parse import urlencode
from urllib.request import HTTPCookieProcessor, Request, build_opener

from app.core.config import settings


def update_smoke_account(*, username: str, role: str, password: str) -> dict:
    base_url = "http://127.0.0.1:8000/api/v1"
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
    return user


def main() -> None:
    username = os.environ["TM_SMOKE_ACCOUNT_USERNAME"]
    role = os.environ["TM_SMOKE_ACCOUNT_ROLE"]
    password = os.environ["TM_CI_PASSWORD"]
    update_smoke_account(username=username, role=role, password=password)
    print(f"스모크 {role} 계정 비밀번호 갱신 완료")


if __name__ == "__main__":
    main()
