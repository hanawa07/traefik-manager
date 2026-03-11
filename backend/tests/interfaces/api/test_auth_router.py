from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from starlette.requests import Request
from starlette.responses import Response

from app.domain.proxy.entities.user import User
from app.interfaces.api.v1.routers import auth as auth_router


def make_request(
    path: str = "/api/v1/auth/login",
    method: str = "POST",
    headers: dict[str, str] | None = None,
    cookies: dict[str, str] | None = None,
) -> Request:
    cookie_header = "; ".join(f"{key}={value}" for key, value in (cookies or {}).items())
    scope = {
        "type": "http",
        "http_version": "1.1",
        "method": method,
        "scheme": "https",
        "path": path,
        "headers": [
            (b"host", b"traefik-manager.example.com"),
            *( [(b"cookie", cookie_header.encode("utf-8"))] if cookie_header else [] ),
            *[(key.lower().encode("utf-8"), value.encode("utf-8")) for key, value in (headers or {}).items()],
        ],
        "query_string": b"",
        "server": ("testserver", 443),
        "client": ("127.0.0.1", 12345),
    }
    return Request(scope)


class StubAuthUseCases:
    def __init__(self, user: User | None):
        self.user = user

    async def authenticate_user(self, username: str, password: str):
        if self.user and username == self.user.username and password == "correct-password":
            return self.user
        return None


class StubAuthSessionRepository:
    def __init__(self):
        self.saved_sessions = []

    async def save(self, session) -> None:
        self.saved_sessions.append(session)


@pytest.mark.asyncio
async def test_login_sets_session_and_csrf_cookies(monkeypatch):
    user = User(
        id=uuid4(),
        username="admin",
        hashed_password="hashed",
        role="admin",
        is_active=True,
        token_version=4,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    repository = StubAuthSessionRepository()
    response = Response()

    monkeypatch.setattr(auth_router, "SQLiteAuthSessionRepository", lambda _db: repository, raising=False)
    monkeypatch.setattr(
        auth_router,
        "issue_session_credentials",
        lambda: SimpleNamespace(
            session_id="session-1",
            secret="secret-1",
            secret_hash="hash-1",
            cookie_value="session-1.secret-1",
        ),
        raising=False,
    )
    monkeypatch.setattr(auth_router, "issue_csrf_token", lambda: "csrf-token-1", raising=False)

    result = await auth_router.login(
        request=make_request(headers={"user-agent": "pytest-browser/1.0"}),
        response=response,
        form=SimpleNamespace(username="admin", password="correct-password"),
        use_cases=StubAuthUseCases(user),
        db=object(),
    )

    set_cookie_headers = response.headers.getlist("set-cookie")

    assert result["username"] == "admin"
    assert result["role"] == "admin"
    assert "access_token" not in result
    assert any("tm_session=session-1.secret-1" in value for value in set_cookie_headers)
    assert any("tm_csrf=csrf-token-1" in value for value in set_cookie_headers)
    assert repository.saved_sessions[0].id == "session-1"
    assert repository.saved_sessions[0].token_version == 4


class StubSessionRepository:
    def __init__(self):
        self.saved_sessions = []

    async def save(self, session) -> None:
        self.saved_sessions.append(session)


@pytest.mark.asyncio
async def test_logout_revokes_current_session_and_clears_cookie(monkeypatch):
    repository = StubSessionRepository()
    response = Response()

    monkeypatch.setattr(auth_router, "SQLiteAuthSessionRepository", lambda _db: repository, raising=False)

    await auth_router.logout(
        response=response,
        current_user={
            "username": "admin",
            "session_id": "session-1",
            "session": SimpleNamespace(id="session-1", revoke=lambda reason: setattr(auth_router, "_revoked_reason", reason)),
        },
        db=object(),
    )

    set_cookie_headers = response.headers.getlist("set-cookie")

    assert repository.saved_sessions[0].id == "session-1"
    assert any("tm_session=" in value and "Max-Age=0" in value for value in set_cookie_headers)
    assert any("tm_csrf=" in value and "Max-Age=0" in value for value in set_cookie_headers)
