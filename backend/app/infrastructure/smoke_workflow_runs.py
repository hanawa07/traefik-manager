from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from app.infrastructure.github_api_rate_limit import record_github_api_rate_limit

_GITHUB_PAGE_SIZE = 100
_CACHE_SECONDS = 600
_RUN_CACHE: dict[
    tuple[str, str, int | None],
    tuple[datetime, list[dict[str, Any]]],
] = {}


async def read_smoke_workflow_runs(
    client: httpx.AsyncClient,
    api_url: str,
    workflow_file: str,
    *,
    recent_days: int | None,
    force_refresh: bool = False,
) -> list[dict[str, Any]]:
    cache_key = (api_url, workflow_file, recent_days)
    now = datetime.now(timezone.utc)
    cached = _RUN_CACHE.get(cache_key)
    if not force_refresh and cached and (now - cached[0]).total_seconds() < _CACHE_SECONDS:
        return cached[1]

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
        record_github_api_rate_limit(response.headers, category="workflow")
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
            _RUN_CACHE[cache_key] = (now, runs)
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
