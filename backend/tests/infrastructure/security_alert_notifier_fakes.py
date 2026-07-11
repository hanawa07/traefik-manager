from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import httpx

from app.infrastructure.notifications import security_alert_notifier


class StubSettingsRepository:
    values: dict[str, str] = {}

    def __init__(self, _session):
        self.values = StubSettingsRepository.values

    async def get(self, key: str) -> str | None:
        return self.values.get(key)


class StubDB:
    def __init__(self):
        self.added = []
        self.flush_calls = 0

    def add(self, item):
        self.added.append(item)

    async def flush(self):
        self.flush_calls += 1


class StubHttpClient:
    def __init__(
        self,
        posted: list | None = None,
        error: Exception | None = None,
        status_code: int = 200,
    ):
        self.posted = posted if posted is not None else []
        self.error = error
        self.status_code = status_code

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, url, json=None):
        if self.error:
            raise self.error
        self.posted.append((url, json))
        return httpx.Response(self.status_code, request=httpx.Request("POST", url))


def patch_settings(monkeypatch, values: dict[str, str]) -> None:
    StubSettingsRepository.values = values
    monkeypatch.setattr(
        security_alert_notifier,
        "SQLiteSystemSettingsRepository",
        StubSettingsRepository,
    )


def patch_http_client(
    monkeypatch,
    posted: list | None = None,
    *,
    error: Exception | None = None,
    status_code: int = 200,
) -> StubHttpClient:
    client = StubHttpClient(posted, error, status_code)
    monkeypatch.setattr(
        security_alert_notifier.httpx,
        "AsyncClient",
        lambda **_kwargs: client,
    )
    return client


def make_audit_log(
    event: str,
    *,
    resource_type: str = "user",
    resource_id: str = "abc",
    resource_name: str = "alice",
):
    return SimpleNamespace(
        actor="system",
        action="update",
        resource_type=resource_type,
        resource_id=resource_id,
        resource_name=resource_name,
        detail={"event": event, "client_ip": "1.2.3.4"},
        created_at=datetime(2026, 3, 11, 17, 0, tzinfo=timezone.utc),
    )


def make_delivery_log(
    event: str,
    *,
    provider: str = "slack",
    source_event: str = "login_locked",
):
    return SimpleNamespace(
        id=uuid4(),
        actor="system",
        action="alert",
        resource_type="settings",
        resource_id="security-alert-delivery",
        resource_name="보안 알림 전송 결과",
        detail={
            "event": event,
            "provider": provider,
            "source_event": source_event,
            "source_action": "update",
            "source_resource_type": "user",
            "source_resource_id": "abc",
            "source_resource_name": "alice",
            "client_ip": "1.2.3.4",
        },
        created_at=datetime(2026, 3, 12, 9, 0, tzinfo=timezone.utc),
    )
