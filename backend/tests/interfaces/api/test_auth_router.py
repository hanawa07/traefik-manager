from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
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
    def __init__(self, result):
        self.result = result
        self.calls = []

    async def authenticate_user(self, username: str, password: str):
        self.calls.append((username, password))
        return self.result


class StubAuthSessionRepository:
    def __init__(self):
        self.saved_sessions = []

    async def save(self, session) -> None:
        self.saved_sessions.append(session)


class StubSystemSettingsRepository:
    values: dict[str, str] = {}

    def __init__(self, _session):
        self.values = StubSystemSettingsRepository.values

    async def get(self, key: str) -> str | None:
        return self.values.get(key)


def stub_turnstile_verifier(monkeypatch, return_value: bool, calls: list[dict] | None = None) -> None:
    async def fake_verify(**kwargs):
        if calls is not None:
            calls.append(kwargs)
        return return_value

    monkeypatch.setattr(
        auth_router.turnstile_verifier,
        "verify_token",
        fake_verify,
        raising=False,
    )


def stub_default_system_settings(monkeypatch, values: dict[str, str] | None = None) -> None:
    StubSystemSettingsRepository.values = values or {}
    monkeypatch.setattr(
        auth_router,
        "SQLiteSystemSettingsRepository",
        StubSystemSettingsRepository,
        raising=False,
    )


def stub_no_suspicious_ip_block(monkeypatch) -> None:
    async def fake_blocker(**_kwargs):
        return False

    monkeypatch.setattr(
        auth_router.login_anomaly_service,
        "enforce_suspicious_ip_block_if_needed",
        fake_blocker,
        raising=False,
    )


def stub_turnstile_risk(monkeypatch, required: bool, calls: list[dict] | None = None) -> None:
    async def fake_risk(**kwargs):
        if calls is not None:
            calls.append(kwargs)
        return required

    monkeypatch.setattr(
        auth_router.login_anomaly_service,
        "should_require_turnstile_for_ip",
        fake_risk,
        raising=False,
    )


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
    stub_default_system_settings(monkeypatch)
    stub_no_suspicious_ip_block(monkeypatch)

    result = await auth_router.login(
        request=make_request(headers={"user-agent": "pytest-browser/1.0"}),
        response=response,
        form=SimpleNamespace(username="admin", password="correct-password"),
        use_cases=StubAuthUseCases(
            SimpleNamespace(
                authenticated_user=user,
                subject_user=user,
                failure_reason=None,
                locked_until=None,
            )
        ),
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


@pytest.mark.asyncio
async def test_get_login_protection_returns_turnstile_public_settings(monkeypatch):
    stub_default_system_settings(
        monkeypatch,
        {
            "login_turnstile_mode": "always",
            "login_turnstile_enabled": "true",
            "login_turnstile_site_key": "0x4AAAAA-example-site-key",
            "login_turnstile_secret_key": "turnstile-secret",
        },
    )

    response = await auth_router.get_login_protection(
        request=make_request(path="/api/v1/auth/login-protection", method="GET"),
        db=object(),
    )

    assert response.turnstile_mode == "always"
    assert response.turnstile_enabled is True
    assert response.turnstile_required is True
    assert response.turnstile_site_key == "0x4AAAAA-example-site-key"


@pytest.mark.asyncio
async def test_get_login_protection_returns_required_false_for_risk_based_without_recent_failures(monkeypatch):
    risk_calls = []
    stub_default_system_settings(
        monkeypatch,
        {
            "login_turnstile_mode": "risk_based",
            "login_turnstile_enabled": "true",
            "login_turnstile_site_key": "0x4AAAAA-example-site-key",
            "login_turnstile_secret_key": "turnstile-secret",
        },
    )
    stub_turnstile_risk(monkeypatch, False, risk_calls)

    response = await auth_router.get_login_protection(
        request=make_request(path="/api/v1/auth/login-protection", method="GET"),
        db=object(),
    )

    assert response.turnstile_mode == "risk_based"
    assert response.turnstile_enabled is True
    assert response.turnstile_required is False
    assert risk_calls[0]["client_ip"] == "127.0.0.1"


@pytest.mark.asyncio
async def test_login_failure_returns_generic_401_and_records_audit(monkeypatch):
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    async def fake_detector(**_kwargs):
        return False

    monkeypatch.setattr(auth_router.audit_service, "record", fake_record, raising=False)
    monkeypatch.setattr(
        auth_router.login_anomaly_service,
        "record_suspicious_login_activity_if_needed",
        fake_detector,
        raising=False,
    )
    stub_default_system_settings(monkeypatch)
    stub_no_suspicious_ip_block(monkeypatch)

    with pytest.raises(HTTPException) as exc_info:
        await auth_router.login(
            request=make_request(headers={"user-agent": "pytest-browser/1.0"}),
            response=Response(),
            form=SimpleNamespace(username="admin", password="wrong-password"),
            use_cases=StubAuthUseCases(
                SimpleNamespace(
                    authenticated_user=None,
                    subject_user=None,
                    failure_reason="invalid_credentials",
                    locked_until=None,
                )
            ),
            db=object(),
        )

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "아이디 또는 비밀번호가 올바르지 않습니다"
    assert recorded[0]["resource_type"] == "user"
    assert recorded[0]["resource_name"] == "admin"
    assert recorded[0]["detail"]["event"] == "login_failure"


@pytest.mark.asyncio
async def test_login_locked_user_returns_generic_401_and_records_lock(monkeypatch):
    now = datetime.now(timezone.utc)
    user = User(
        id=uuid4(),
        username="admin",
        hashed_password="hashed",
        role="admin",
        is_active=True,
        token_version=0,
        created_at=now,
        updated_at=now,
    )
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    async def fake_detector(**_kwargs):
        return False

    monkeypatch.setattr(auth_router.audit_service, "record", fake_record, raising=False)
    monkeypatch.setattr(
        auth_router.login_anomaly_service,
        "record_suspicious_login_activity_if_needed",
        fake_detector,
        raising=False,
    )
    stub_default_system_settings(monkeypatch)
    stub_no_suspicious_ip_block(monkeypatch)

    with pytest.raises(HTTPException) as exc_info:
        await auth_router.login(
            request=make_request(headers={"user-agent": "pytest-browser/1.0"}),
            response=Response(),
            form=SimpleNamespace(username="admin", password="correct-password"),
            use_cases=StubAuthUseCases(
                SimpleNamespace(
                    authenticated_user=None,
                    subject_user=user,
                    failure_reason="locked",
                    locked_until=now + timedelta(minutes=15),
                )
            ),
            db=object(),
        )

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "아이디 또는 비밀번호가 올바르지 않습니다"
    assert recorded[0]["detail"]["event"] == "login_locked"


@pytest.mark.asyncio
async def test_login_failure_invokes_suspicious_login_detector(monkeypatch):
    recorded = []
    detector_calls = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    async def fake_detector(**kwargs):
        detector_calls.append(kwargs)
        return False

    monkeypatch.setattr(auth_router.audit_service, "record", fake_record, raising=False)
    monkeypatch.setattr(
        auth_router.login_anomaly_service,
        "record_suspicious_login_activity_if_needed",
        fake_detector,
        raising=False,
    )
    stub_default_system_settings(monkeypatch)
    stub_no_suspicious_ip_block(monkeypatch)

    with pytest.raises(HTTPException):
        await auth_router.login(
            request=make_request(headers={"user-agent": "pytest-browser/1.0"}),
            response=Response(),
            form=SimpleNamespace(username="admin", password="wrong-password"),
            use_cases=StubAuthUseCases(
                SimpleNamespace(
                    authenticated_user=None,
                    subject_user=None,
                    failure_reason="invalid_credentials",
                    locked_until=None,
                )
            ),
            db=object(),
        )

    assert recorded[0]["detail"]["event"] == "login_failure"
    assert detector_calls[0]["client_ip"] == "127.0.0.1"


@pytest.mark.asyncio
async def test_login_blocks_suspicious_ip_before_authentication(monkeypatch):
    use_cases = StubAuthUseCases(
        SimpleNamespace(
            authenticated_user=None,
            subject_user=None,
            failure_reason="invalid_credentials",
            locked_until=None,
        )
    )

    async def fake_blocker(**_kwargs):
        return True

    monkeypatch.setattr(
        auth_router.login_anomaly_service,
        "enforce_suspicious_ip_block_if_needed",
        fake_blocker,
        raising=False,
    )
    stub_default_system_settings(monkeypatch)

    with pytest.raises(HTTPException) as exc_info:
        await auth_router.login(
            request=make_request(headers={"user-agent": "pytest-browser/1.0"}),
            response=Response(),
            form=SimpleNamespace(username="admin", password="correct-password"),
            use_cases=use_cases,
            db=object(),
        )

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "아이디 또는 비밀번호가 올바르지 않습니다"
    assert use_cases.calls == []


@pytest.mark.asyncio
async def test_login_requires_turnstile_token_when_enabled(monkeypatch):
    use_cases = StubAuthUseCases(
        SimpleNamespace(
            authenticated_user=None,
            subject_user=None,
            failure_reason="invalid_credentials",
            locked_until=None,
        )
    )
    stub_default_system_settings(
        monkeypatch,
        {
            "login_turnstile_mode": "always",
            "login_turnstile_enabled": "true",
            "login_turnstile_site_key": "0x4AAAAA-example-site-key",
            "login_turnstile_secret_key": "turnstile-secret",
        },
    )
    stub_no_suspicious_ip_block(monkeypatch)

    with pytest.raises(HTTPException) as exc_info:
        await auth_router.login(
            request=make_request(headers={"user-agent": "pytest-browser/1.0"}),
            response=Response(),
            form=SimpleNamespace(username="admin", password="correct-password"),
            use_cases=use_cases,
            db=object(),
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "추가 로그인 검증에 실패했습니다"
    assert use_cases.calls == []


@pytest.mark.asyncio
async def test_login_verifies_turnstile_token_when_enabled(monkeypatch):
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
    verify_calls = []

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
    stub_default_system_settings(
        monkeypatch,
        {
            "login_turnstile_mode": "always",
            "login_turnstile_enabled": "true",
            "login_turnstile_site_key": "0x4AAAAA-example-site-key",
            "login_turnstile_secret_key": "turnstile-secret",
        },
    )
    stub_no_suspicious_ip_block(monkeypatch)
    stub_turnstile_verifier(monkeypatch, True, verify_calls)

    request = make_request(
        headers={
            "user-agent": "pytest-browser/1.0",
            "content-type": "application/x-www-form-urlencoded",
        }
    )
    request._form = {
        "cf-turnstile-response": "turnstile-token-123",
    }

    result = await auth_router.login(
        request=request,
        response=response,
        form=SimpleNamespace(username="admin", password="correct-password"),
        use_cases=StubAuthUseCases(
            SimpleNamespace(
                authenticated_user=user,
                subject_user=user,
                failure_reason=None,
                locked_until=None,
            )
        ),
        db=object(),
    )

    assert result["username"] == "admin"
    assert verify_calls[0]["token"] == "turnstile-token-123"
    assert verify_calls[0]["secret_key"] == "turnstile-secret"
    assert verify_calls[0]["remote_ip"] == "127.0.0.1"


@pytest.mark.asyncio
async def test_login_skips_turnstile_when_risk_based_mode_not_required(monkeypatch):
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
    risk_calls = []
    verify_calls = []

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
    stub_default_system_settings(
        monkeypatch,
        {
            "login_turnstile_mode": "risk_based",
            "login_turnstile_enabled": "true",
            "login_turnstile_site_key": "0x4AAAAA-example-site-key",
            "login_turnstile_secret_key": "turnstile-secret",
        },
    )
    stub_no_suspicious_ip_block(monkeypatch)
    stub_turnstile_risk(monkeypatch, False, risk_calls)
    stub_turnstile_verifier(monkeypatch, True, verify_calls)

    result = await auth_router.login(
        request=make_request(headers={"user-agent": "pytest-browser/1.0"}),
        response=response,
        form=SimpleNamespace(username="admin", password="correct-password"),
        use_cases=StubAuthUseCases(
            SimpleNamespace(
                authenticated_user=user,
                subject_user=user,
                failure_reason=None,
                locked_until=None,
            )
        ),
        db=object(),
    )

    assert result["username"] == "admin"
    assert risk_calls[0]["client_ip"] == "127.0.0.1"
    assert verify_calls == []


@pytest.mark.asyncio
async def test_login_requires_turnstile_when_risk_based_mode_is_required(monkeypatch):
    use_cases = StubAuthUseCases(
        SimpleNamespace(
            authenticated_user=None,
            subject_user=None,
            failure_reason="invalid_credentials",
            locked_until=None,
        )
    )
    stub_default_system_settings(
        monkeypatch,
        {
            "login_turnstile_mode": "risk_based",
            "login_turnstile_enabled": "true",
            "login_turnstile_site_key": "0x4AAAAA-example-site-key",
            "login_turnstile_secret_key": "turnstile-secret",
        },
    )
    stub_no_suspicious_ip_block(monkeypatch)
    stub_turnstile_risk(monkeypatch, True)

    with pytest.raises(HTTPException) as exc_info:
        await auth_router.login(
            request=make_request(headers={"user-agent": "pytest-browser/1.0"}),
            response=Response(),
            form=SimpleNamespace(username="admin", password="correct-password"),
            use_cases=use_cases,
            db=object(),
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "추가 로그인 검증에 실패했습니다"
    assert use_cases.calls == []


@pytest.mark.asyncio
async def test_login_passes_trusted_network_policy_to_suspicious_blocker(monkeypatch):
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
    blocker_calls = []

    async def fake_blocker(**kwargs):
        blocker_calls.append(kwargs)
        return False

    StubSystemSettingsRepository.values = {
        "login_suspicious_block_enabled": "false",
        "login_suspicious_trusted_networks": "10.0.0.0/8\n203.0.113.10/32",
        "login_suspicious_block_escalation_enabled": "true",
        "login_suspicious_block_escalation_window_minutes": "720",
        "login_suspicious_block_escalation_multiplier": "3",
        "login_suspicious_block_max_minutes": "2880",
    }
    monkeypatch.setattr(auth_router, "SQLiteAuthSessionRepository", lambda _db: repository, raising=False)
    stub_default_system_settings(monkeypatch, StubSystemSettingsRepository.values)
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
    monkeypatch.setattr(
        auth_router.login_anomaly_service,
        "enforce_suspicious_ip_block_if_needed",
        fake_blocker,
        raising=False,
    )

    await auth_router.login(
        request=make_request(headers={"user-agent": "pytest-browser/1.0"}),
        response=response,
        form=SimpleNamespace(username="admin", password="correct-password"),
        use_cases=StubAuthUseCases(
            SimpleNamespace(
                authenticated_user=user,
                subject_user=user,
                failure_reason=None,
                locked_until=None,
            )
        ),
        db=object(),
    )

    assert blocker_calls[0]["block_enabled"] is False
    assert blocker_calls[0]["trusted_networks"] == ["10.0.0.0/8", "203.0.113.10/32"]
    assert blocker_calls[0]["escalation_enabled"] is True
    assert blocker_calls[0]["escalation_window"] == timedelta(minutes=720)
    assert blocker_calls[0]["escalation_multiplier"] == 3
    assert blocker_calls[0]["max_block_window"] == timedelta(minutes=2880)


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
