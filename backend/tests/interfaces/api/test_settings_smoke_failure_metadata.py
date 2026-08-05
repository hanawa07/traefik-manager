import json
from datetime import datetime

import pytest

from app.interfaces.api.v1.routers.settings_smoke_failure_metadata import (
    SMOKE_FAILURE_METADATA_KEY,
    SMOKE_FAILURE_METADATA_LIMIT_KEY,
    attach_smoke_failure_metadata,
    attach_smoke_failure_type_statistics,
    build_smoke_failure_type_increase_alerts,
    read_smoke_failure_metadata,
    record_smoke_failure_metadata,
    trim_smoke_failure_metadata,
)


class StubRepository:
    def __init__(self) -> None:
        self.values: dict[str, str] = {}

    @property
    def value(self) -> str | None:
        return self.values.get(SMOKE_FAILURE_METADATA_KEY)

    async def get(self, key: str) -> str | None:
        return self.values.get(key)

    async def set(self, key: str, value: str) -> None:
        self.values[key] = value


def _failure_run(run_id: int, completed_at: str) -> dict[str, object]:
    return {
        "run_id": run_id,
        "run_number": run_id,
        "completed_at": completed_at,
        "run_url": f"https://github.com/example/repository/actions/runs/{run_id}",
    }


@pytest.mark.asyncio
async def test_smoke_failure_metadata_keeps_latest_twenty_unique_runs() -> None:
    repo = StubRepository()
    for run_id in range(1, 23):
        await record_smoke_failure_metadata(
            repo,
            run_id=run_id,
            metadata={
                "captured_at": "2026-07-21T01:02:03Z",
                "check_name": f"실패 {run_id}",
                "screen_path": "/dashboard/settings",
                "page_title": "설정",
            },
        )

    stored = json.loads(repo.value)
    indexed = await read_smoke_failure_metadata(repo)

    assert len(stored) == 20
    assert list(indexed) == list(range(22, 2, -1))
    assert indexed[22]["failure_type"] == "visual_regression"
    assert SMOKE_FAILURE_METADATA_KEY == "dashboard_smoke_failure_metadata"

    history = {
        "runs": [{"run_id": 22, "status": "success"}],
        "latest_failure": None,
    }
    attach_smoke_failure_metadata(history, indexed)
    assert history["runs"][0]["failure_metadata"] is None


@pytest.mark.asyncio
async def test_smoke_failure_metadata_uses_configured_limit_and_trims_immediately() -> None:
    repo = StubRepository()
    repo.values[SMOKE_FAILURE_METADATA_LIMIT_KEY] = "25"
    for run_id in range(1, 28):
        await record_smoke_failure_metadata(
            repo,
            run_id=run_id,
            metadata={
                "captured_at": "2026-07-21T01:02:03Z",
                "check_name": f"실패 {run_id}",
            },
        )

    assert len(json.loads(repo.value)) == 25
    assert await trim_smoke_failure_metadata(repo, limit=20) == 20
    assert [entry["run_id"] for entry in json.loads(repo.value)] == list(range(27, 7, -1))


def test_failure_type_statistics_counts_full_window_and_invalid_metadata() -> None:
    statistics = [
        {"window_days": 7, "failure_count": 3},
        {"window_days": 30, "failure_count": 4},
    ]
    metadata = {
        1: {
            "run_id": 1,
            "captured_at": "2026-07-21T23:30:00Z",
            "failure_type": "login",
        },
        2: {
            "run_id": 2,
            "captured_at": "2026-07-20T01:00:00Z",
            "failure_type": "external_api",
        },
        3: {
            "run_id": 3,
            "captured_at": "invalid",
            "failure_type": "visual_regression",
        },
    }

    attach_smoke_failure_type_statistics(
        statistics,
        {
            7: [
                _failure_run(1, "2026-07-21T23:30:00Z"),
                _failure_run(2, "2026-07-20T01:00:00Z"),
                _failure_run(4, "2026-07-19T01:00:00Z"),
            ],
            14: [
                _failure_run(1, "2026-07-21T23:30:00Z"),
                _failure_run(2, "2026-07-20T01:00:00Z"),
                _failure_run(4, "2026-07-19T01:00:00Z"),
            ],
            30: [
                _failure_run(1, "2026-07-21T23:30:00Z"),
                _failure_run(2, "2026-07-20T01:00:00Z"),
                _failure_run(3, "2026-07-18T01:00:00Z"),
                _failure_run(4, "2026-07-19T01:00:00Z"),
            ],
        },
        metadata,
        timezone_name="Asia/Seoul",
    )

    assert statistics[0]["failure_type_counts"] == {
        "login": 1,
        "external_api": 1,
        "visual_regression": 0,
        "unclassified": 1,
    }
    assert statistics[0]["failure_type_daily"] == [
        {
            "captured_on": "2026-07-19",
            "login": 0,
            "external_api": 0,
            "visual_regression": 0,
            "unclassified": 1,
        },
        {
            "captured_on": "2026-07-20",
            "login": 0,
            "external_api": 1,
            "visual_regression": 0,
            "unclassified": 0,
        },
        {
            "captured_on": "2026-07-22",
            "login": 1,
            "external_api": 0,
            "visual_regression": 0,
            "unclassified": 0,
        },
    ]
    assert statistics[0]["failure_type_runs"][2] == {
        "run_id": 4,
        "run_number": 4,
        "run_url": "https://github.com/example/repository/actions/runs/4",
        "completed_at": "2026-07-19T01:00:00Z",
        "occurred_on": "2026-07-19",
        "failure_type": "unclassified",
    }
    assert statistics[0]["failure_type_increase_alerts"] == []
    assert statistics[1]["failure_type_counts"]["visual_regression"] == 1
    assert statistics[1]["failure_type_counts"]["unclassified"] == 1


def test_failure_type_statistics_warns_when_recent_type_increases() -> None:
    statistics = [{"window_days": 7, "failure_count": 2}]
    metadata = {
        run_id: {
            "run_id": run_id,
            "captured_at": "2026-07-22T01:00:00Z",
            "failure_type": "login",
        }
        for run_id in (1, 2, 3)
    }

    attach_smoke_failure_type_statistics(
        statistics,
        {
            7: [
                _failure_run(1, "2026-07-22T01:00:00Z"),
                _failure_run(2, "2026-07-21T01:00:00Z"),
            ],
            14: [
                _failure_run(1, "2026-07-22T01:00:00Z"),
                _failure_run(2, "2026-07-21T01:00:00Z"),
                _failure_run(3, "2026-07-15T01:00:00Z"),
            ],
            30: [],
        },
        metadata,
        timezone_name="Asia/Seoul",
    )

    assert statistics[0]["failure_type_increase_alerts"] == [
        {
            "failure_type": "login",
            "recent_count": 2,
            "previous_count": 1,
        }
    ]


def test_failure_metadata_increase_alert_uses_rolling_two_week_window() -> None:
    metadata = {
        1: {"failure_type": "login", "captured_at": "2026-08-05T00:00:00Z"},
        2: {"failure_type": "login", "captured_at": "2026-08-04T00:00:00Z"},
        3: {"failure_type": "login", "captured_at": "2026-07-28T00:00:00Z"},
        4: {"failure_type": "external_api", "captured_at": "2026-08-03T00:00:00Z"},
    }

    assert build_smoke_failure_type_increase_alerts(
        metadata,
        now=datetime.fromisoformat("2026-08-06T00:00:00+00:00"),
    ) == [
        {
            "failure_type": "login",
            "recent_count": 2,
            "previous_count": 1,
        }
    ]
