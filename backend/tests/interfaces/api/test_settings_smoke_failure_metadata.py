import json

import pytest

from app.interfaces.api.v1.routers.settings_smoke_failure_metadata import (
    SMOKE_FAILURE_METADATA_KEY,
    attach_smoke_failure_metadata,
    attach_smoke_failure_type_statistics,
    read_smoke_failure_metadata,
    record_smoke_failure_metadata,
)


class StubRepository:
    value: str | None = None

    async def get(self, _key: str) -> str | None:
        return self.value

    async def set(self, _key: str, value: str) -> None:
        self.value = value


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
        {7: [1, 2, 4], 30: [1, 2, 3, 4]},
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
            "captured_on": "2026-07-20",
            "login": 0,
            "external_api": 1,
            "visual_regression": 0,
        },
        {
            "captured_on": "2026-07-22",
            "login": 1,
            "external_api": 0,
            "visual_regression": 0,
        },
    ]
    assert statistics[1]["failure_type_counts"]["visual_regression"] == 1
    assert statistics[1]["failure_type_counts"]["unclassified"] == 1
