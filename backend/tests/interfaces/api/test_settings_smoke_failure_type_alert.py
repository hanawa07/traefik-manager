import json
from datetime import datetime

import pytest

from app.infrastructure.notifications.security_alert_routes import (
    get_alert_category_and_group,
)
from app.infrastructure.notifications.security_alert_messages import build_telegram_message
from app.interfaces.api.v1.routers.settings_smoke_failure_metadata import (
    record_smoke_failure_metadata,
)
from app.interfaces.api.v1.routers.settings_smoke_failure_type_alert import (
    record_smoke_failure_type_increase_alerts,
)


class StubRepository:
    def __init__(self) -> None:
        self.values = {"dashboard_smoke_failure_type_alert_enabled": "true"}

    async def get(self, key: str) -> str | None:
        return self.values.get(key)

    async def set(self, key: str, value: str) -> None:
        self.values[key] = value


class StubAuditService:
    def __init__(self) -> None:
        self.records: list[dict] = []

    async def record(self, **kwargs) -> None:
        self.records.append(kwargs)


class StubAuditLog:
    actor = "traefik-smoke-viewer"
    resource_name = "로그인"
    created_at = datetime.fromisoformat("2026-08-06T00:00:00+00:00")
    detail = {
        "event": "smoke_failure_type_increase",
        "window_days": 7,
        "recent_count": 2,
        "previous_count": 1,
    }


@pytest.mark.asyncio
async def test_failure_type_alert_notifies_only_when_increase_becomes_active() -> None:
    repo = StubRepository()
    audit = StubAuditService()
    for run_id, captured_at in enumerate(
        (
            "2026-08-05T00:00:00Z",
            "2026-08-04T00:00:00Z",
            "2026-07-28T00:00:00Z",
        ),
        start=1,
    ):
        await record_smoke_failure_metadata(
            repo,
            run_id=run_id,
            metadata={
                "captured_at": captured_at,
                "check_name": "로그인 검사 실패",
                "failure_type": "login",
            },
        )

    now = datetime.fromisoformat("2026-08-06T00:00:00+00:00")
    first = await record_smoke_failure_type_increase_alerts(
        repo=repo,
        db=object(),
        audit_service=audit,
        actor="traefik-smoke-viewer",
        now=now,
    )
    second = await record_smoke_failure_type_increase_alerts(
        repo=repo,
        db=object(),
        audit_service=audit,
        actor="traefik-smoke-viewer",
        now=now,
    )

    assert first[0]["failure_type"] == "login"
    assert second == []
    assert len(audit.records) == 1
    assert audit.records[0]["notify"] is True
    assert json.loads(repo.values["dashboard_smoke_failure_type_alert_state"]) == ["login"]
    assert get_alert_category_and_group("smoke_failure_type_increase") == (
        "change",
        "manager_health",
    )
    assert get_alert_category_and_group("smoke_failure_type_increase_test") == (
        "change",
        "manager_health",
    )
    message = build_telegram_message(
        StubAuditLog(),
        "smoke_failure_type_increase",
        "change",
    )
    assert "스모크 실패 유형 증가: 로그인" in message
    assert "실패 횟수: 2건 / 직전 7일 1건" in message
