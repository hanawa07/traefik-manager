import json
from datetime import datetime, timezone

import pytest

from app.infrastructure.smoke_local_run_records import (
    SMOKE_LOCAL_RUN_KEY_PREFIX,
    read_smoke_local_runs,
    record_smoke_host_run,
    record_smoke_local_run,
)


class StubRepository:
    def __init__(self, values: dict[str, str] | None = None) -> None:
        self.values = values or {}

    async def get_all_dict(self) -> dict[str, str]:
        return dict(self.values)

    async def set(self, key: str, value: str) -> None:
        self.values[key] = value

    async def delete(self, key: str) -> None:
        self.values.pop(key, None)


@pytest.mark.asyncio
async def test_record_smoke_local_run_is_idempotent_and_removes_expired() -> None:
    expired_key = f"{SMOKE_LOCAL_RUN_KEY_PREFIX}1"
    repository = StubRepository(
        {
            expired_key: json.dumps(
                {
                    "run_id": 1,
                    "status": "failure",
                    "started_at": None,
                    "completed_at": "2025-08-01T00:00:00+00:00",
                    "duration_seconds": None,
                    "admin_checked": False,
                }
            ),
            "unrelated": "kept",
        }
    )
    completed_at = datetime(2026, 8, 2, 1, 2, tzinfo=timezone.utc)

    record = await record_smoke_local_run(
        repository,
        run_id=2,
        status="success",
        started_at=datetime(2026, 8, 2, 1, 0, tzinfo=timezone.utc),
        completed_at=completed_at,
        admin_checked=True,
    )
    records, total = await read_smoke_local_runs(repository, now=completed_at)

    assert record["duration_seconds"] == 120
    assert records == [record]
    assert total == 1
    assert expired_key not in repository.values
    assert repository.values["unrelated"] == "kept"
    current_key = f"{SMOKE_LOCAL_RUN_KEY_PREFIX}2"
    assert len(repository.values[current_key]) < 1024

    await record_smoke_local_run(
        repository,
        run_id=2,
        status="failure",
        started_at=None,
        completed_at=completed_at,
    )
    updated, total = await read_smoke_local_runs(repository, now=completed_at)
    assert total == 1
    assert updated[0]["status"] == "failure"
    assert updated[0]["duration_seconds"] is None


@pytest.mark.asyncio
async def test_host_runs_are_kept_separate_from_github_callbacks() -> None:
    repository = StubRepository()
    completed_at = datetime(2026, 8, 2, 1, 2, tzinfo=timezone.utc)
    await record_smoke_host_run(
        repository,
        status="success",
        started_at=datetime(2026, 8, 2, 1, 0, tzinfo=timezone.utc),
        completed_at=completed_at,
        revision="ABCDEF1234567",
    )

    github_runs, github_total = await read_smoke_local_runs(
        repository,
        now=completed_at,
        source="github",
    )
    host_runs, host_total = await read_smoke_local_runs(
        repository,
        now=completed_at,
        source="host",
    )

    assert github_runs == []
    assert github_total == 0
    assert host_total == 1
    assert host_runs[0]["source"] == "host"
    assert host_runs[0]["revision"] == "abcdef1234567"
    assert host_runs[0]["duration_seconds"] == 120


@pytest.mark.asyncio
async def test_invalid_host_record_types_are_ignored() -> None:
    repository = StubRepository(
        {
            f"{SMOKE_LOCAL_RUN_KEY_PREFIX}3": json.dumps(
                {
                    "run_id": 3,
                    "status": "success",
                    "started_at": None,
                    "completed_at": "2026-08-02T01:02:00+00:00",
                    "duration_seconds": None,
                    "admin_checked": True,
                    "source": [],
                    "revision": 123,
                }
            )
        }
    )

    records, total = await read_smoke_local_runs(
        repository,
        now=datetime(2026, 8, 2, 1, 2, tzinfo=timezone.utc),
        source="host",
    )

    assert records == []
    assert total == 0
