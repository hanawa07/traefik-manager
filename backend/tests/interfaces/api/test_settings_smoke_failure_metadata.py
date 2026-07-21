import json

import pytest

from app.interfaces.api.v1.routers.settings_smoke_failure_metadata import (
    SMOKE_FAILURE_METADATA_KEY,
    attach_smoke_failure_metadata,
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
    assert SMOKE_FAILURE_METADATA_KEY == "dashboard_smoke_failure_metadata"

    history = {
        "runs": [{"run_id": 22, "status": "success"}],
        "latest_failure": None,
    }
    attach_smoke_failure_metadata(history, indexed)
    assert history["runs"][0]["failure_metadata"] is None
