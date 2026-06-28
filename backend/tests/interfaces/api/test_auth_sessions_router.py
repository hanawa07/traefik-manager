from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from starlette.responses import Response

from app.domain.auth.entities.auth_session import AuthSession
from app.interfaces.api.v1.routers import auth as auth_router
from tests.interfaces.api.auth_router_fakes import StubSessionRepository


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
