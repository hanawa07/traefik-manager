from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.domain.auth.entities.auth_session import AuthSession
from app.domain.proxy.entities.user import User
from app.interfaces.api import dependencies
from app.interfaces.api.dependencies import require_admin, require_write_access


def make_request(
    path: str = "/api/v1/auth/me",
    method: str = "GET",
    cookies: dict[str, str] | None = None,
    headers: dict[str, str] | None = None,
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


class StubUserRepository:
    def __init__(self, user: User | None):
        self.user = user

    async def find_by_id(self, _user_id):
        return self.user


class StubAuthSessionRepository:
    def __init__(self, auth_session: AuthSession | None):
        self.auth_session = auth_session

    async def find_by_id(self, _session_id: str):
        return self.auth_session

    async def save(self, session: AuthSession) -> None:
        self.auth_session = session


@pytest.mark.asyncio
async def test_require_write_access_allows_admin():
    user = {"username": "admin", "role": "admin"}

    resolved = await require_write_access(user)

    assert resolved["role"] == "admin"


@pytest.mark.asyncio
async def test_require_write_access_blocks_viewer():
    user = {"username": "viewer", "role": "viewer"}

    with pytest.raises(HTTPException) as exc:
        await require_write_access(user)

    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_require_admin_blocks_viewer():
    user = {"username": "viewer", "role": "viewer"}

    with pytest.raises(HTTPException) as exc:
        await require_admin(user)

    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_get_current_user_blocks_missing_session_cookie():
    request = make_request()

    with pytest.raises(HTTPException) as exc:
        await dependencies.get_current_user(request=request, db=object())

    assert exc.value.status_code == 401
    assert exc.value.detail == "로그인이 필요합니다"


@pytest.mark.asyncio
async def test_get_current_user_returns_session_metadata(monkeypatch):
    user = User(
        id=uuid4(),
        username="admin",
        hashed_password="hashed",
        role="admin",
        is_active=True,
        token_version=2,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    auth_session = AuthSession.issue(
        session_id="session-1",
        session_secret_hash="hash-1",
        user_id=str(user.id),
        username="admin",
        role="admin",
        token_version=2,
        absolute_ttl=timedelta(hours=8),
        idle_ttl=timedelta(hours=1),
        now=datetime.now(timezone.utc),
    )
    request = make_request(cookies={"tm_session": "session-1.secret-1"})

    monkeypatch.setattr(dependencies, "verify_session_secret", lambda secret, expected_hash: secret == "secret-1")
    monkeypatch.setattr(
        dependencies,
        "SQLiteAuthSessionRepository",
        lambda _db: StubAuthSessionRepository(auth_session),
    )
    monkeypatch.setattr(dependencies, "SQLiteUserRepository", lambda _db: StubUserRepository(user))

    current_user = await dependencies.get_current_user(request=request, db=object())

    assert current_user["id"] == str(user.id)
    assert current_user["username"] == "admin"
    assert current_user["session_id"] == "session-1"


@pytest.mark.asyncio
async def test_get_current_user_blocks_missing_csrf_for_mutation(monkeypatch):
    user = User(
        id=uuid4(),
        username="admin",
        hashed_password="hashed",
        role="admin",
        is_active=True,
        token_version=0,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    auth_session = AuthSession.issue(
        session_id="session-1",
        session_secret_hash="hash-1",
        user_id=str(user.id),
        username="admin",
        role="admin",
        token_version=0,
        absolute_ttl=timedelta(hours=8),
        idle_ttl=timedelta(hours=1),
        now=datetime.now(timezone.utc),
    )
    request = make_request(
        path="/api/v1/services/",
        method="POST",
        cookies={"tm_session": "session-1.secret-1", "tm_csrf": "csrf-cookie"},
    )

    monkeypatch.setattr(dependencies, "verify_session_secret", lambda secret, expected_hash: secret == "secret-1")
    monkeypatch.setattr(
        dependencies,
        "SQLiteAuthSessionRepository",
        lambda _db: StubAuthSessionRepository(auth_session),
    )
    monkeypatch.setattr(dependencies, "SQLiteUserRepository", lambda _db: StubUserRepository(user))

    with pytest.raises(HTTPException) as exc:
        await dependencies.get_current_user(request=request, db=object())

    assert exc.value.status_code == 403
    assert exc.value.detail == "CSRF 검증에 실패했습니다"
