from datetime import datetime, timezone
from typing import Any

import httpx

from app.infrastructure.github_api_rate_limit import record_github_api_rate_limit

_CACHE_SECONDS = 600
_JOB_CACHE: dict[tuple[str, int], tuple[datetime, list[dict[str, Any]]]] = {}
_ARTIFACT_CACHE: dict[
    tuple[str, str, int],
    tuple[datetime, dict[str, str | None] | None],
] = {}


async def read_smoke_job_steps(
    client: httpx.AsyncClient,
    api_url: str,
    run_id: int,
    *,
    force_refresh: bool = False,
) -> list[dict[str, Any]]:
    cache_key = (api_url, run_id)
    now = datetime.now(timezone.utc)
    cached = _JOB_CACHE.get(cache_key)
    if not force_refresh and cached and (now - cached[0]).total_seconds() < _CACHE_SECONDS:
        return cached[1]
    try:
        response = await client.get(
            f"{api_url}/actions/runs/{run_id}/jobs",
            params={"per_page": 10},
        )
        record_github_api_rate_limit(response.headers)
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError, TypeError):
        return []
    jobs = payload.get("jobs") if isinstance(payload, dict) else None
    if not isinstance(jobs, list):
        return []
    steps = [
        step
        for job in jobs
        if isinstance(job, dict) and isinstance(job.get("steps"), list)
        for step in job["steps"]
        if isinstance(step, dict)
    ]
    _JOB_CACHE[cache_key] = (now, steps)
    return steps


async def read_smoke_artifacts(
    client: httpx.AsyncClient,
    api_url: str,
    public_url: str,
    run_ids: set[int],
    *,
    force_refresh: bool = False,
) -> dict[int, dict[str, str | None]]:
    now = datetime.now(timezone.utc)
    details: dict[int, dict[str, str | None]] = {}
    missing: set[int] = set()
    for run_id in run_ids:
        cached = _ARTIFACT_CACHE.get((api_url, public_url, run_id))
        if force_refresh or not cached or (now - cached[0]).total_seconds() >= _CACHE_SECONDS:
            missing.add(run_id)
        elif cached[1] is not None:
            details[run_id] = cached[1]
    if not missing:
        return details
    try:
        response = await client.get(
            f"{api_url}/actions/artifacts",
            params={"per_page": 100},
        )
        record_github_api_rate_limit(response.headers)
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError, TypeError):
        return details
    artifacts = payload.get("artifacts") if isinstance(payload, dict) else None
    fetched = build_smoke_artifacts(artifacts, run_ids=missing, public_url=public_url)
    for run_id in missing:
        detail = fetched.get(run_id)
        _ARTIFACT_CACHE[(api_url, public_url, run_id)] = (now, detail)
        if detail is not None:
            details[run_id] = detail
    return details


def build_smoke_artifacts(
    raw_artifacts: object,
    *,
    run_ids: set[int],
    public_url: str,
) -> dict[int, dict[str, str | None]]:
    if not isinstance(raw_artifacts, list):
        return {}
    details: dict[int, dict[str, str | None]] = {}
    for artifact in raw_artifacts:
        workflow_run = artifact.get("workflow_run") if isinstance(artifact, dict) else None
        run_id = workflow_run.get("id") if isinstance(workflow_run, dict) else None
        artifact_id = artifact.get("id") if isinstance(artifact, dict) else None
        if (
            not isinstance(run_id, int)
            or run_id not in run_ids
            or not isinstance(artifact_id, int)
            or artifact.get("name") != f"dashboard-visual-smoke-{run_id}"
            or artifact.get("expired") is not False
        ):
            continue
        expires_at = artifact.get("expires_at")
        details.setdefault(
            run_id,
            {
                "url": f"{public_url}/actions/runs/{run_id}/artifacts/{artifact_id}",
                "expires_at": str(expires_at).strip() or None
                if expires_at is not None
                else None,
            },
        )
    return details
