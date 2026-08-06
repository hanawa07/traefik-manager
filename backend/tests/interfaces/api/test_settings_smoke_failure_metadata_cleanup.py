import json

import pytest
from pydantic import ValidationError

from app.interfaces.api.v1.routers import settings_smoke_failure_metadata_cleanup as cleanup_module
from app.interfaces.api.v1.schemas.settings_smoke_rotation_schemas import (
    SmokeFailureMetadataCleanupRequest,
)


class StubRepository:
    def __init__(self) -> None:
        self.values = {
            "dashboard_smoke_failure_metadata": json.dumps(
                [
                    {
                        "run_id": run_id,
                        "captured_at": "2026-08-01T00:00:00Z",
                        "check_name": f"실패 {run_id}",
                        "failure_type": "login",
                    }
                    for run_id in (3, 2, 1)
                ]
            )
        }

    async def get(self, key: str) -> str | None:
        return self.values.get(key)

    async def set(self, key: str, value: str) -> None:
        self.values[key] = value


class StubAuditService:
    def __init__(self) -> None:
        self.records: list[dict] = []

    async def record(self, **kwargs) -> None:
        self.records.append(kwargs)


@pytest.mark.parametrize("run_ids", [[], [0], [-1]])
def test_cleanup_request_rejects_empty_or_invalid_run_ids(run_ids: list[int]) -> None:
    with pytest.raises(ValidationError):
        SmokeFailureMetadataCleanupRequest(run_ids=run_ids)


@pytest.mark.asyncio
async def test_cleanup_smoke_failure_metadata_records_destructive_action(monkeypatch) -> None:
    repo = StubRepository()
    audit = StubAuditService()
    cache_invalidations = []

    async def fake_invalidate_cache() -> None:
        cache_invalidations.append(True)

    monkeypatch.setattr(cleanup_module, "invalidate_smoke_history_cache", fake_invalidate_cache)

    result = await cleanup_module.cleanup_smoke_failure_metadata_action(
        request=SmokeFailureMetadataCleanupRequest(run_ids=[2, 3]),
        actor={"username": "lizstudio", "role": "admin"},
        db=object(),
        settings_repository_factory=lambda _db: repo,
        audit_service=audit,
        client_ip="127.0.0.1",
    )

    assert result.deleted_count == 2
    assert result.retained_count == 1
    assert cache_invalidations == [True]
    assert audit.records[0]["action"] == "delete"
    assert audit.records[0]["notify"] is False
    assert audit.records[0]["detail"] == {
        "event": "smoke_failure_metadata_cleanup",
        "requested_run_ids": [2, 3],
        "deleted_count": 2,
        "retained_count": 1,
        "client_ip": "127.0.0.1",
    }
