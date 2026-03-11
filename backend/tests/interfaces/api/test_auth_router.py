from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from starlette.requests import Request
from starlette.responses import Response

from app.domain.auth.entities.auth_session import AuthSession
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
    def __init__(self, sessions=None):
        self.saved_sessions = []
        self.sessions = {session.id: session for session in (sessions or [])}

    async def save(self, session) -> None:
        self.saved_sessions.append(session)
        self.sessions[session.id] = session

    async def find_active_by_user_id(self, user_id: str, _now):
        return [
            session
            for session in self.sessions.values()
            if session.user_id == user_id and session.revoked_at is None
        ]

    async def find_by_id(self, session_id: str):
        return self.sessions.get(session_id)


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


@pytest.mark.asyncio
async def test_list_sessions_returns_current_and_other_sessions(monkeypatch):
    current_session = SimpleNamespace(
        id="session-current",
        user_id="user-1",
        issued_at=datetime.now(timezone.utc),
        last_seen_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc),
        idle_expires_at=datetime.now(timezone.utc),
        ip_address="10.0.0.1",
        user_agent="browser-a",
        revoked_at=None,
    )
    other_session = SimpleNamespace(
        id="session-other",
        user_id="user-1",
        issued_at=datetime.now(timezone.utc),
        last_seen_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc),
        idle_expires_at=datetime.now(timezone.utc),
        ip_address="10.0.0.2",
        user_agent="browser-b",
        revoked_at=None,
    )
    repository = StubSessionRepository([current_session, other_session])

    monkeypatch.setattr(auth_router, "SQLiteAuthSessionRepository", lambda _db: repository, raising=False)

    result = await auth_router.list_sessions(
        current_user={
            "id": "user-1",
            "username": "admin",
            "role": "admin",
            "session_id": "session-current",
            "session": current_session,
        },
        db=object(),
    )

    assert [item.session_id for item in result.sessions] == ["session-current", "session-other"]
    assert result.sessions[0].is_current is True
    assert result.sessions[1].is_current is False


@pytest.mark.asyncio
async def test_logout_all_revokes_all_user_sessions_and_clears_cookie(monkeypatch):
    current_session = AuthSession.issue(
        session_id="session-current",
        session_secret_hash="hash-current",
        user_id="user-1",
        username="admin",
        role="admin",
        token_version=0,
        absolute_ttl=timedelta(hours=8),
        idle_ttl=timedelta(hours=1),
        now=datetime.now(timezone.utc),
    )
    other_session = AuthSession.issue(
        session_id="session-other",
        session_secret_hash="hash-other",
        user_id="user-1",
        username="admin",
        role="admin",
        token_version=0,
        absolute_ttl=timedelta(hours=8),
        idle_ttl=timedelta(hours=1),
        now=datetime.now(timezone.utc),
    )
    repository = StubSessionRepository([current_session, other_session])
    response = Response()

    monkeypatch.setattr(auth_router, "SQLiteAuthSessionRepository", lambda _db: repository, raising=False)

    await auth_router.logout_all_sessions(
        response=response,
        current_user={
            "id": "user-1",
            "username": "admin",
            "role": "admin",
            "session_id": "session-current",
            "session": current_session,
        },
        db=object(),
    )

    assert len(repository.saved_sessions) == 2
    assert all(session.revoked_at is not None for session in repository.saved_sessions)
    set_cookie_headers = response.headers.getlist("set-cookie")
    assert any("tm_session=" in value and "Max-Age=0" in value for value in set_cookie_headers)
    assert any("tm_csrf=" in value and "Max-Age=0" in value for value in set_cookie_headers)


@pytest.mark.asyncio
async def test_revoke_session_revokes_target_session_and_clears_cookie_when_current(monkeypatch):
    current_session = AuthSession.issue(
        session_id="session-current",
        session_secret_hash="hash-current",
        user_id="user-1",
        username="admin",
        role="admin",
        token_version=0,
        absolute_ttl=timedelta(hours=8),
        idle_ttl=timedelta(hours=1),
        now=datetime.now(timezone.utc),
    )
    repository = StubSessionRepository([current_session])
    response = Response()

    monkeypatch.setattr(auth_router, "SQLiteAuthSessionRepository", lambda _db: repository, raising=False)

    await auth_router.revoke_session(
        session_id="session-current",
        response=response,
        current_user={
            "id": "user-1",
            "username": "admin",
            "role": "admin",
            "session_id": "session-current",
            "session": current_session,
        },
        db=object(),
    )

    assert repository.saved_sessions[0].id == "session-current"
    assert repository.saved_sessions[0].revoked_at is not None
    set_cookie_headers = response.headers.getlist("set-cookie")
    assert any("tm_session=" in value and "Max-Age=0" in value for value in set_cookie_headers)
