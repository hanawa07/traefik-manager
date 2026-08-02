import pytest

from app.infrastructure import smoke_run_history_fetcher
from app.infrastructure.smoke_run_history_processing import needs_job_details


def test_cancelled_history_does_not_request_job_details() -> None:
    assert needs_job_details({"conclusion": "cancelled", "event": "schedule"}) is False
    assert needs_job_details({"conclusion": "failure", "event": "workflow_dispatch"}) is True
    assert needs_job_details({"conclusion": "success", "event": "schedule"}) is True


@pytest.mark.asyncio
async def test_seven_day_history_reuses_thirty_day_workflow_source(monkeypatch) -> None:
    requested_days = []

    async def fake_runs(*_args, recent_days, **_kwargs):
        requested_days.append(recent_days)
        return []

    monkeypatch.setattr(
        smoke_run_history_fetcher,
        "read_smoke_workflow_runs",
        fake_runs,
    )

    history = await smoke_run_history_fetcher.fetch_smoke_run_history(
        "https://api.github.com/repos/example/repository",
        "https://github.com/example/repository",
        recent_days=7,
    )

    assert requested_days == [30]
    assert [item["window_days"] for item in history["statistics"]] == [7, 30]
