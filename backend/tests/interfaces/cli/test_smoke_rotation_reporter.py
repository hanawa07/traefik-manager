from datetime import datetime, timezone

import pytest

from app.core.smoke_rotation_status import (
    SMOKE_ROTATION_DETAIL_KEY,
    SMOKE_ROTATION_LAST_ATTEMPT_AT_KEY,
    SMOKE_ROTATION_LAST_REVISION_KEY,
    SMOKE_ROTATION_LAST_SUCCESS_AT_KEY,
    SMOKE_ROTATION_STATUS_KEY,
)
from app.interfaces.cli.smoke_rotation_reporter import record_smoke_rotation_status


class StubRepository:
    def __init__(self):
        self.values: dict[str, str | None] = {}

    async def set(self, key: str, value: str | None) -> None:
        self.values[key] = value

    async def get_all_dict(self) -> dict[str, str | None]:
        return dict(self.values)

    async def delete(self, key: str) -> None:
        self.values.pop(key, None)


@pytest.mark.asyncio
async def test_record_smoke_rotation_success_updates_last_success() -> None:
    repo = StubRepository()
    now = datetime(2026, 7, 10, 4, 17, tzinfo=timezone.utc)
    recorded: list[dict] = []

    async def record_audit(**kwargs) -> None:
        recorded.append(kwargs)

    await record_smoke_rotation_status(
        db=object(),
        repo=repo,
        status="success",
        revision="ABCDEF1234567",
        now=now,
        audit_recorder=record_audit,
    )

    assert repo.values[SMOKE_ROTATION_STATUS_KEY] == "success"
    assert repo.values[SMOKE_ROTATION_LAST_ATTEMPT_AT_KEY] == now.isoformat()
    assert repo.values[SMOKE_ROTATION_LAST_SUCCESS_AT_KEY] == now.isoformat()
    assert repo.values[SMOKE_ROTATION_LAST_REVISION_KEY] == "abcdef1234567"
    assert repo.values[SMOKE_ROTATION_DETAIL_KEY] is None
    assert recorded[0]["detail"] == {
        "event": "smoke_rotation_succeeded",
        "revision": "abcdef1234567",
    }
    assert recorded[0]["resource_id"] == "smoke-accounts"


@pytest.mark.asyncio
async def test_record_smoke_rotation_stores_host_run_duration() -> None:
    repo = StubRepository()
    started_at = datetime(2026, 7, 10, 4, 15, tzinfo=timezone.utc)
    completed_at = datetime(2026, 7, 10, 4, 17, tzinfo=timezone.utc)

    async def record_audit(**_kwargs) -> None:
        return None

    await record_smoke_rotation_status(
        db=object(),
        repo=repo,
        status="success",
        revision="abcdef1234567",
        started_at=started_at,
        now=completed_at,
        audit_recorder=record_audit,
    )

    run_values = [
        value
        for key, value in repo.values.items()
        if key.startswith("dashboard_smoke_local_run_")
    ]
    assert len(run_values) == 1
    assert '"source":"host"' in (run_values[0] or "")
    assert '"duration_seconds":120' in (run_values[0] or "")


@pytest.mark.asyncio
async def test_record_smoke_rotation_rejects_invalid_revision() -> None:
    with pytest.raises(ValueError, match="배포 커밋 형식"):
        await record_smoke_rotation_status(
            db=object(),
            repo=StubRepository(),
            status="success",
            revision="not-a-revision",
        )


@pytest.mark.asyncio
async def test_record_smoke_rotation_failure_records_alert_event() -> None:
    repo = StubRepository()
    recorded: list[dict] = []

    async def record_audit(**kwargs) -> None:
        recorded.append(kwargs)

    await record_smoke_rotation_status(
        db=object(),
        repo=repo,
        status="failure",
        detail="GitHub secret 갱신",
        audit_recorder=record_audit,
    )

    assert repo.values[SMOKE_ROTATION_STATUS_KEY] == "failure"
    assert repo.values[SMOKE_ROTATION_DETAIL_KEY] == "GitHub secret 갱신"
    assert recorded[0]["detail"] == {
        "event": "smoke_rotation_failed",
        "step": "GitHub secret 갱신",
    }
    assert recorded[0]["resource_id"] == "smoke-accounts"
