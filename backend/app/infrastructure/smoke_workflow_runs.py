from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

_GITHUB_PAGE_SIZE = 100


async def read_smoke_workflow_runs(
    client: httpx.AsyncClient,
    api_url: str,
    workflow_file: str,
    *,
    recent_days: int | None,
) -> list[dict[str, Any]]:
    runs: list[dict[str, Any]] = []
    cutoff = (
        datetime.now(timezone.utc) - timedelta(days=recent_days)
        if recent_days is not None
        else None
    )
    page = 1
    while True:
        response = await client.get(
            f"{api_url}/actions/workflows/{workflow_file}/runs",
            params={"per_page": _GITHUB_PAGE_SIZE, "page": page},
        )
        response.raise_for_status()
        payload = response.json()
        page_runs = payload.get("workflow_runs") if isinstance(payload, dict) else None
        if not isinstance(page_runs, list):
            raise ValueError("workflow_runs must be a list")
        runs.extend(page_runs)
        if (
            cutoff is None
            or len(page_runs) < _GITHUB_PAGE_SIZE
            or _page_reaches_cutoff(page_runs, cutoff)
        ):
            return runs
        page += 1


def parse_run_timestamp(value: str) -> datetime | None:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _page_reaches_cutoff(runs: list[object], cutoff: datetime) -> bool:
    for run in runs:
        updated_at = run.get("updated_at") if isinstance(run, dict) else None
        parsed = parse_run_timestamp(updated_at) if isinstance(updated_at, str) else None
        if parsed is not None and parsed < cutoff:
            return True
    return False
