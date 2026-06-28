from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

from starlette.requests import Request

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
            *([(b"cookie", cookie_header.encode("utf-8"))] if cookie_header else []),
            *[(key.lower().encode("utf-8"), value.encode("utf-8")) for key, value in (headers or {}).items()],
        ],
        "query_string": b"",
        "server": ("testserver", 443),
        "client": ("127.0.0.1", 12345),
    }
    return Request(scope)


def make_user(*, token_version: int = 4, now: datetime | None = None) -> User:
    current_time = now or datetime.now(timezone.utc)
    return User(
        id=uuid4(),
        username="admin",
        hashed_password="hashed",
        role="admin",
        is_active=True,
        token_version=token_version,
        created_at=current_time,
        updated_at=current_time,
    )


def authenticated_result(user: User) -> SimpleNamespace:
    return SimpleNamespace(
        authenticated_user=user,
        subject_user=user,
        failure_reason=None,
        locked_until=None,
    )


def failed_auth_result(
    *,
    subject_user=None,
    failure_reason: str = "invalid_credentials",
    locked_until=None,
) -> SimpleNamespace:
    return SimpleNamespace(
        authenticated_user=None,
        subject_user=subject_user,
        failure_reason=failure_reason,
        locked_until=locked_until,
    )


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


class StubSystemSettingsRepository:
    values: dict[str, str] = {}

    def __init__(self, _session):
        self.values = StubSystemSettingsRepository.values

    async def get(self, key: str) -> str | None:
        return self.values.get(key)


def stub_session_credentials(monkeypatch, repository: StubAuthSessionRepository) -> None:
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
