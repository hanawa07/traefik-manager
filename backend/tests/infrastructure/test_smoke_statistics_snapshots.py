import json
from datetime import datetime, timezone

import pytest

from app.infrastructure.smoke_statistics_snapshots import (
    SMOKE_STATISTICS_SNAPSHOT_KEY_PREFIX,
    sync_smoke_statistics_snapshots,
)


class StubRepository:
    def __init__(self, values: dict[str, str]) -> None:
        self.values = values

    async def get_all_dict(self) -> dict[str, str]:
        return dict(self.values)

    async def set(self, key: str, value: str) -> None:
        self.values[key] = value

    async def delete(self, key: str) -> None:
        self.values.pop(key, None)


def _statistics() -> list[dict]:
    return [
        {
            "window_days": 30,
            "total_count": 12,
            "success_count": 8,
            "failure_count": 2,
            "cancelled_count": 1,
            "skipped_count": 1,
            "duration_run_count": 11,
            "total_duration_seconds": 900,
            "average_duration_seconds": 82,
            "estimated_runner_minutes": 18,
        }
    ]


@pytest.mark.asyncio
async def test_sync_smoke_statistics_snapshots_records_daily_and_removes_expired() -> None:
    expired_key = f"{SMOKE_STATISTICS_SNAPSHOT_KEY_PREFIX}20250802"
    malformed_key = f"{SMOKE_STATISTICS_SNAPSHOT_KEY_PREFIX}invalid"
    repository = StubRepository(
        {
            expired_key: json.dumps(
                {"captured_on": "2025-08-02", "window_days": 30}
            ),
            malformed_key: "not-json",
            "unrelated": "kept",
        }
    )

    snapshots = await sync_smoke_statistics_snapshots(
        repository,
        _statistics(),
        checked_at="2026-08-02T06:00:00Z",
        now=datetime(2026, 8, 2, tzinfo=timezone.utc),
    )

    assert snapshots == [
        {
            "captured_on": "2026-08-02",
            "window_days": 30,
            **{key: value for key, value in _statistics()[0].items() if key != "window_days"},
        }
    ]
    assert expired_key not in repository.values
    assert repository.values[malformed_key] == "not-json"
    assert repository.values["unrelated"] == "kept"
    current_key = f"{SMOKE_STATISTICS_SNAPSHOT_KEY_PREFIX}20260802"
    assert len(repository.values[current_key]) < 1024

    updated_statistics = _statistics()
    updated_statistics[0]["estimated_runner_minutes"] = 19
    updated = await sync_smoke_statistics_snapshots(
        repository,
        updated_statistics,
        checked_at="2026-08-02T23:00:00Z",
        now=datetime(2026, 8, 2, tzinfo=timezone.utc),
    )

    assert len(updated) == 1
    assert updated[0]["estimated_runner_minutes"] == 19
