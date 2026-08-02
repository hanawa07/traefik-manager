import asyncio
from datetime import datetime, timezone
from typing import Any

import httpx

from app.infrastructure.github_api_rate_limit import (
    github_api_rate_limit_error_message,
    track_github_api_requests,
)
from app.infrastructure.smoke_run_details import (
    read_smoke_artifacts,
    read_smoke_job_steps,
)
from app.infrastructure.smoke_run_history_processing import (
    RECENT_RUN_LIMIT,
    build_smoke_run_item,
    classify_smoke_cancellation_reason,
    is_failed_smoke_run,
    needs_job_details,
    paginate_smoke_runs,
    select_smoke_run_groups,
)
from app.infrastructure.smoke_run_statistics import build_smoke_run_statistics
from app.infrastructure.smoke_workflow_runs import read_smoke_workflow_runs

WORKFLOW_FILE = "dashboard-visual-smoke.yml"


async def fetch_smoke_run_history(
    api_url: str,
    public_url: str,
    *,
    force_refresh: bool = False,
    recent_days: int | None = None,
    page: int = 1,
    search: str = "",
    status_filter: str = "all",
    cancellation_reason_filter: str = "all",
) -> dict[str, Any]:
    api_requests: dict[str, int] = {}
    try:
        with track_github_api_requests() as api_requests:
            async with httpx.AsyncClient(
                timeout=4.0,
                headers={
                    "Accept": "application/vnd.github+json",
                    "User-Agent": "traefik-manager",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
            ) as client:
                raw_runs = await read_smoke_workflow_runs(
                    client,
                    api_url,
                    WORKFLOW_FILE,
                    recent_days=30 if recent_days in {7, 30} else recent_days,
                    force_refresh=force_refresh,
                )
                statistics_reference_time = datetime.now(timezone.utc)
                all_runs, latest_failure_run = select_smoke_run_groups(
                    raw_runs,
                    recent_days=recent_days,
                    now=statistics_reference_time,
                    search=search,
                    status_filter=status_filter,
                    cancellation_reason_filter=cancellation_reason_filter,
                )
                runs, total, total_pages = paginate_smoke_runs(all_runs, page=page)
                detail_runs = list(runs)
                if latest_failure_run and all(
                    run["id"] != latest_failure_run["id"] for run in detail_runs
                ):
                    detail_runs.append(latest_failure_run)
                artifact_run_ids = {
                    run["id"]
                    for run in detail_runs
                    if is_failed_smoke_run(run)
                }
                jobs, artifacts = await asyncio.gather(
                    asyncio.gather(
                        *(
                            read_smoke_job_steps(
                                client,
                                api_url,
                                run["id"],
                                force_refresh=force_refresh,
                            )
                            if needs_job_details(run)
                            else _empty_steps()
                            for run in detail_runs
                        )
                    ),
                    read_smoke_artifacts(
                        client,
                        api_url,
                        public_url,
                        artifact_run_ids,
                        force_refresh=force_refresh,
                    )
                    if artifact_run_ids
                    else _empty_artifacts(),
                )
    except httpx.HTTPStatusError as error:
        return build_smoke_history_error(
            github_api_rate_limit_error_message(
                error.response.status_code,
                error.response.headers,
                error.response.text,
            )
            or "GitHub 실행 이력을 확인하지 못했습니다",
            recent_days=recent_days,
            page=page,
            search=search,
            status_filter=status_filter,
            cancellation_reason_filter=cancellation_reason_filter,
            github_api_request_usage=api_requests,
        )
    except (httpx.HTTPError, ValueError, TypeError):
        return build_smoke_history_error(
            "GitHub 실행 이력을 확인하지 못했습니다",
            recent_days=recent_days,
            page=page,
            search=search,
            status_filter=status_filter,
            cancellation_reason_filter=cancellation_reason_filter,
            github_api_request_usage=api_requests,
        )

    job_steps = {
        run["id"]: steps for run, steps in zip(detail_runs, jobs, strict=True)
    }
    items = {
        run["id"]: build_smoke_run_item(
            run,
            job_steps[run["id"]],
            public_url=public_url,
            artifact=artifacts.get(run["id"]),
            cancellation_reason=classify_smoke_cancellation_reason(run, raw_runs),
        )
        for run in detail_runs
    }
    return {
        "runs": [items[run["id"]] for run in runs],
        "latest_failure": items.get(latest_failure_run["id"])
        if latest_failure_run
        else None,
        "statistics": build_smoke_run_statistics(
            raw_runs,
            now=statistics_reference_time,
        ),
        "recent_days": recent_days,
        "page": page,
        "per_page": RECENT_RUN_LIMIT,
        "total": total,
        "total_pages": total_pages,
        "search": search,
        "status_filter": status_filter,
        "cancellation_reason_filter": cancellation_reason_filter,
        "github_api_request_usage": api_requests.copy(),
        "error": None,
    }


def build_smoke_history_error(
    message: str,
    *,
    recent_days: int | None = None,
    page: int = 1,
    search: str = "",
    status_filter: str = "all",
    cancellation_reason_filter: str = "all",
    github_api_request_usage: dict[str, int] | None = None,
) -> dict[str, Any]:
    return {
        "runs": [],
        "latest_failure": None,
        "statistics": [],
        "checked_at": None,
        "recent_days": recent_days,
        "page": page,
        "per_page": RECENT_RUN_LIMIT,
        "total": 0,
        "total_pages": 0,
        "search": search,
        "status_filter": status_filter,
        "cancellation_reason_filter": cancellation_reason_filter,
        "github_api_request_usage": github_api_request_usage,
        "error": message,
    }


async def _empty_steps() -> list[dict[str, Any]]:
    return []


async def _empty_artifacts() -> dict[int, dict[str, str | None]]:
    return {}
