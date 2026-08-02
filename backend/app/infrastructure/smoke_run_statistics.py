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


def build_smoke_run_statistics(
    raw_runs: object,
    *,
    now: datetime | None = None,
) -> list[dict[str, int]]:
    reference_time = now or datetime.now(timezone.utc)
    return [
        _build_window_statistics(raw_runs, days=days, now=reference_time)
        for days in STATISTICS_WINDOWS
    ]


def _build_window_statistics(
    raw_runs: object,
    *,
    days: int,
    now: datetime,
) -> dict[str, int]:
    runs = select_operational_smoke_runs(raw_runs, recent_days=days, now=now)
    counts = {status: 0 for status in ("success", "failure", "cancelled", "skipped")}
    durations = []
    for run in runs:
        counts[_run_status(run)] += 1
        duration = _run_duration_seconds(run)
        if duration is not None:
            durations.append(duration)

    total_duration = sum(durations)
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
        "estimated_runner_minutes": sum(max(1, math.ceil(value / 60)) for value in durations),
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
