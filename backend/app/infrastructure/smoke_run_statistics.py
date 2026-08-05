import math
from datetime import datetime, timezone
from typing import Any

from app.infrastructure.smoke_run_history_processing import (
    is_cancelled_smoke_run,
    is_failed_smoke_run,
    select_operational_smoke_runs,
)
from app.infrastructure.smoke_workflow_runs import parse_run_timestamp

STATISTICS_WINDOWS = (7, 30)
FAILURE_DETAIL_WINDOWS = (7, 14, 30)
SLOWEST_RUN_LIMIT = 5


def build_smoke_run_statistics(
    raw_runs: object,
    *,
    public_url: str,
    now: datetime | None = None,
) -> list[dict[str, Any]]:
    reference_time = now or datetime.now(timezone.utc)
    return [
        _build_window_statistics(
            raw_runs,
            days=days,
            now=reference_time,
            public_url=public_url,
        )
        for days in STATISTICS_WINDOWS
    ]


def build_smoke_failure_runs_by_window(
    raw_runs: object,
    *,
    public_url: str,
    now: datetime | None = None,
) -> dict[int, list[dict[str, Any]]]:
    reference_time = now or datetime.now(timezone.utc)
    return {
        days: [
            {
                "run_id": run["id"],
                "run_number": (
                    run.get("run_number")
                    if isinstance(run.get("run_number"), int)
                    else None
                ),
                "completed_at": run["updated_at"],
                "run_url": f"{public_url}/actions/runs/{run['id']}",
            }
            for run in select_operational_smoke_runs(
                raw_runs,
                recent_days=days,
                now=reference_time,
            )
            if is_failed_smoke_run(run)
        ]
        for days in FAILURE_DETAIL_WINDOWS
    }


def _build_window_statistics(
    raw_runs: object,
    *,
    days: int,
    now: datetime,
    public_url: str,
) -> dict[str, Any]:
    runs = select_operational_smoke_runs(raw_runs, recent_days=days, now=now)
    counts = {status: 0 for status in ("success", "failure", "cancelled", "skipped")}
    durations: list[tuple[int, dict[str, Any]]] = []
    for run in runs:
        counts[_run_status(run)] += 1
        duration = _run_duration_seconds(run)
        if duration is not None:
            durations.append((duration, run))

    total_duration = sum(duration for duration, _run in durations)
    return {
        "window_days": days,
        "total_count": len(runs),
        "success_count": counts["success"],
        "failure_count": counts["failure"],
        "cancelled_count": counts["cancelled"],
        "skipped_count": counts["skipped"],
        "duration_run_count": len(durations),
        "total_duration_seconds": total_duration,
        "average_duration_seconds": round(total_duration / len(durations)) if durations else 0,
        "estimated_runner_minutes": sum(
            max(1, math.ceil(duration / 60)) for duration, _run in durations
        ),
        "slowest_runs": [
            _build_slow_run(run, duration, public_url)
            for duration, run in sorted(durations, key=lambda item: item[0], reverse=True)[
                :SLOWEST_RUN_LIMIT
            ]
        ],
    }


def _run_status(run: dict[str, Any]) -> str:
    if is_cancelled_smoke_run(run):
        return "cancelled"
    if is_failed_smoke_run(run):
        return "failure"
    return "skipped" if run.get("conclusion") == "skipped" else "success"


def _run_duration_seconds(run: dict[str, Any]) -> int | None:
    started_at = parse_run_timestamp(
        str(run.get("run_started_at") or run.get("created_at") or "")
    )
    completed_at = parse_run_timestamp(str(run.get("updated_at") or ""))
    if started_at is None or completed_at is None or completed_at < started_at:
        return None
    return int((completed_at - started_at).total_seconds())


def _build_slow_run(
    run: dict[str, Any],
    duration_seconds: int,
    public_url: str,
) -> dict[str, Any]:
    head_sha = str(run.get("head_sha") or "").strip()
    run_number = run.get("run_number")
    return {
        "run_id": run["id"],
        "run_number": run_number if isinstance(run_number, int) else None,
        "status": _run_status(run),
        "completed_at": run["updated_at"],
        "duration_seconds": duration_seconds,
        "commit_sha": head_sha[:7] or None,
        "run_url": f"{public_url}/actions/runs/{run['id']}",
    }
