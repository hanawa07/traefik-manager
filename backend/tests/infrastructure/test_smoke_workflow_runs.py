from datetime import datetime, timedelta, timezone

import pytest

from app.infrastructure.smoke_workflow_runs import read_smoke_workflow_runs


class _Response:
    def __init__(self, runs: list[dict]) -> None:
        self._runs = runs

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return {"workflow_runs": self._runs}


class _Client:
    def __init__(self, pages: list[list[dict]]) -> None:
        self.calls: list[int] = []
        self.pages = pages

    async def get(self, _url: str, *, params: dict) -> _Response:
        page = params["page"]
        self.calls.append(page)
        return _Response(self.pages[page - 1])


@pytest.mark.asyncio
async def test_read_smoke_workflow_runs_pages_only_until_requested_period() -> None:
    now = datetime.now(timezone.utc)
    recent = {"updated_at": (now - timedelta(days=1)).isoformat()}
    old = {"updated_at": (now - timedelta(days=31)).isoformat()}
    client = _Client([[recent] * 100, [recent] * 99 + [old], [recent]])

    runs = await read_smoke_workflow_runs(
        client,
        "https://api.github.com/repos/example/repo",
        "smoke.yml",
        recent_days=30,
    )

    assert len(runs) == 200
    assert client.calls == [1, 2]

    default_client = _Client([[recent] * 100, [recent]])
    await read_smoke_workflow_runs(
        default_client,
        "https://api.github.com/repos/example/repo",
        "smoke.yml",
        recent_days=None,
    )
    assert default_client.calls == [1]
