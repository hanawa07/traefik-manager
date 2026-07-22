import pytest

from app.interfaces.api.v1.routers.settings_github_api_rate_limit_audit import (
    record_github_api_rate_limit_audit,
)


@pytest.mark.asyncio
async def test_github_api_rate_limit_audit_records_occurrence_without_notification() -> None:
    calls = []
    db = object()

    class AuditService:
        async def record(self, **kwargs) -> None:
            calls.append(kwargs)

    await record_github_api_rate_limit_audit(
        audit_service=AuditService(),
        db=db,
        actor="lizstudio",
        rate_limit_event={
            "kind": "secondary",
            "occurred_at": "2026-07-22T01:00:00+00:00",
            "occurrence_count": 2,
            "retry_at": "2026-07-22T01:01:00+00:00",
            "sequence": 3,
        },
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
                "occurrence_count": 2,
                "retry_at": "2026-07-22T01:01:00+00:00",
            },
            "notify": False,
        }
    ]
