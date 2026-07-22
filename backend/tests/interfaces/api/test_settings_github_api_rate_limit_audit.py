from datetime import datetime, timezone

import pytest

from app.interfaces.api.v1.routers.settings_github_api_rate_limit_audit import (
    record_github_api_rate_limit_audit,
)


@pytest.mark.asyncio
async def test_github_api_rate_limit_audit_records_occurrence_without_notification() -> None:
    calls = []

    class CountResult:
        def scalar_one(self) -> int:
            return 4

    class Database:
        async def execute(self, _query):
            return CountResult()

    db = Database()

    class AuditService:
        async def record(self, **kwargs) -> None:
            calls.append(kwargs)

    class Repository:
        async def get(self, _key: str) -> str | None:
            return None

    await record_github_api_rate_limit_audit(
        audit_service=AuditService(),
        db=db,
        actor="lizstudio",
        rate_limit_event={
            "kind": "secondary",
            "occurred_at": "2026-07-22T01:00:00+00:00",
            "retry_at": "2026-07-22T01:01:00+00:00",
            "sequence": 3,
        },
        settings_repository_factory=lambda _db: Repository(),
    )

    assert calls == [
        {
            "db": db,
            "actor": "lizstudio",
            "action": "alert",
            "resource_type": "settings",
            "resource_id": "github_api_secondary_rate_limit",
            "resource_name": "GitHub API 보조 요청 제한",
            "detail": {
                "event": "github_api_secondary_rate_limit",
                "occurred_at": "2026-07-22T01:00:00+00:00",
                "occurrence_count": 5,
                "retry_at": "2026-07-22T01:01:00+00:00",
            },
            "notify": False,
        }
    ]


@pytest.mark.asyncio
async def test_github_api_rate_limit_audit_realerts_after_configured_window() -> None:
    calls = []
    counts = iter([8, 2, 0, 9, 3, 1, 10, 5, 0])

    class CountResult:
        def __init__(self, count: int) -> None:
            self.count = count

        def scalar_one(self) -> int:
            return self.count

    class Database:
        async def execute(self, _query):
            return CountResult(next(counts))

    class Repository:
        async def get(self, key: str) -> str | None:
            return {
                "dashboard_smoke_github_rate_limit_alert_enabled": "true",
                "dashboard_smoke_github_primary_limit_alert_threshold": "3",
                "dashboard_smoke_github_secondary_limit_alert_threshold": "3",
                "dashboard_smoke_github_rate_limit_alert_window_hours": "24",
            }.get(key)

    class AuditService:
        async def record(self, **kwargs) -> None:
            calls.append(kwargs)

    db = Database()
    await record_github_api_rate_limit_audit(
        audit_service=AuditService(),
        db=db,
        actor="lizstudio",
        rate_limit_event={
            "kind": "primary",
            "occurred_at": "2026-07-22T01:00:00+00:00",
            "retry_at": None,
        },
        settings_repository_factory=lambda _db: Repository(),
        now=datetime(2026, 7, 22, 1, 0, tzinfo=timezone.utc),
    )
    await record_github_api_rate_limit_audit(
        audit_service=AuditService(),
        db=db,
        actor="lizstudio",
        rate_limit_event={
            "kind": "primary",
            "occurred_at": "2026-07-22T01:01:00+00:00",
            "retry_at": None,
        },
        settings_repository_factory=lambda _db: Repository(),
        now=datetime(2026, 7, 22, 1, 1, tzinfo=timezone.utc),
    )
    await record_github_api_rate_limit_audit(
        audit_service=AuditService(),
        db=db,
        actor="lizstudio",
        rate_limit_event={
            "kind": "primary",
            "occurred_at": "2026-07-23T01:01:00+00:00",
            "retry_at": None,
        },
        settings_repository_factory=lambda _db: Repository(),
        now=datetime(2026, 7, 23, 1, 1, tzinfo=timezone.utc),
    )

    assert [call["notify"] for call in calls] == [True, False, True]
    assert calls[0]["detail"] == {
        "event": "github_api_primary_rate_limit",
        "occurred_at": "2026-07-22T01:00:00+00:00",
        "occurrence_count": 9,
        "retry_at": None,
        "alert_triggered": True,
        "alert_window_hours": 24,
        "alert_cooldown_hours": 24,
        "alert_threshold": 3,
        "window_occurrence_count": 3,
    }
    assert calls[2]["detail"]["alert_triggered"] is True
