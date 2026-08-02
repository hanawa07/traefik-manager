from datetime import datetime, timedelta, timezone
from typing import Any

from app.infrastructure.smoke_workflow_runs import parse_run_timestamp

RECENT_RUN_LIMIT = 5
_CANCELLED_CONCLUSIONS = {"cancelled", "timed_out"}
_CANCELLATION_REASON_LABELS = {
    "timeout": "시간 초과",
    "superseded": "새 실행으로 대체 추정",
    "manual_or_unknown": "수동 취소 또는 원인 미확인",
}
_CANCELLATION_REASON_FILTERS = {"all", *_CANCELLATION_REASON_LABELS}


def build_smoke_run_item(
    run: dict[str, Any],
    steps: list[dict[str, Any]],
    *,
    public_url: str,
    artifact: dict[str, str | None] | None = None,
    cancellation_reason: str | None = None,
) -> dict[str, Any]:
    smoke_step = _find_step(steps, "운영 로그인·화면 검사")
    conclusion = _clean_text(run.get("conclusion"))
    if conclusion in _CANCELLED_CONCLUSIONS:
        status = "cancelled"
        cancellation_reason = cancellation_reason or classify_smoke_cancellation_reason(run, [])
        cancelled_step = next(
            (
                step
                for step in steps
                if step.get("conclusion") in _CANCELLED_CONCLUSIONS
            ),
            None,
        )
        step_name = _clean_text(cancelled_step.get("name")) if cancelled_step else None
        reason_label = _CANCELLATION_REASON_LABELS[cancellation_reason]
        summary = (
            f"GitHub {reason_label}: {step_name[:120]} · 앱 실패율 제외"
            if step_name
            else f"GitHub {reason_label} · 앱 실패율 제외"
        )
    elif conclusion == "skipped" or (
        smoke_step and smoke_step.get("conclusion") == "skipped"
    ):
        status = "skipped"
        summary = "예약 설정에 따라 점검을 건너뜀"
    elif conclusion == "success":
        status = "success"
        summary = None
    else:
        status = "failure"
        failed_step = next(
            (
                step
                for step in steps
                if step.get("conclusion") in {"failure", "cancelled", "timed_out"}
            ),
            None,
        )
        step_name = _clean_text(failed_step.get("name")) if failed_step else None
        summary = (
            f"실패 단계: {step_name[:120]}"
            if step_name
            else f"GitHub 결과: {conclusion or '알 수 없음'}"
        )

    cooldown_step = _find_step(steps, "반복 실패 알림 cooldown 확인")
    telegram_step = _find_step(steps, "Telegram 실패 알림")
    suppressed = bool(
        status == "failure"
        and cooldown_step
        and cooldown_step.get("conclusion") == "success"
        and telegram_step
        and telegram_step.get("conclusion") == "skipped"
    )
    run_id = run["id"]
    head_sha = _clean_text(run.get("head_sha"))
    return {
        "run_id": run_id,
        "status": status,
        "completed_at": run["updated_at"],
        "run_url": f"{public_url}/actions/runs/{run_id}",
        "run_number": (
            run.get("run_number") if isinstance(run.get("run_number"), int) else None
        ),
        "commit_sha": head_sha[:7] if head_sha else None,
        "summary": summary,
        "cancellation_reason": cancellation_reason if status == "cancelled" else None,
        "notification_suppressed": suppressed,
        "artifact_url": (
            artifact.get("url") if status == "failure" and artifact else None
        ),
        "artifact_expires_at": (
            artifact.get("expires_at") if status == "failure" and artifact else None
        ),
    }


def classify_smoke_cancellation_reason(
    run: dict[str, Any],
    all_runs: list[dict[str, Any]],
) -> str | None:
    conclusion = _clean_text(run.get("conclusion"))
    if conclusion == "timed_out":
        return "timeout"
    if conclusion != "cancelled":
        return None

    started_at = _run_started_at(run)
    cancelled_at = _timestamp(run.get("updated_at"))
    if started_at and cancelled_at:
        run_id = run.get("id")
        for candidate in all_runs:
            candidate_started_at = _run_started_at(candidate)
            if (
                candidate.get("id") != run_id
                and candidate_started_at
                and started_at < candidate_started_at <= cancelled_at
            ):
                return "superseded"
    return "manual_or_unknown"


def select_smoke_run_groups(
    raw_runs: object,
    *,
    recent_days: int | None = None,
    now: datetime | None = None,
    search: str = "",
    status_filter: str = "all",
    cancellation_reason_filter: str = "all",
) -> tuple[list[dict[str, Any]], dict[str, Any] | None]:
    operational_runs = select_operational_smoke_runs(
        raw_runs,
        recent_days=recent_days,
        now=now,
    )
    latest_failure = next((run for run in operational_runs if is_failed_smoke_run(run)), None)
    filtered_runs = filter_smoke_runs(
        operational_runs,
        search=search,
        status_filter=status_filter,
        cancellation_reason_filter=cancellation_reason_filter,
    )
    return (
        filtered_runs if recent_days is not None else filtered_runs[:RECENT_RUN_LIMIT],
        latest_failure,
    )


def select_operational_smoke_runs(
    raw_runs: object,
    *,
    recent_days: int | None = None,
    now: datetime | None = None,
) -> list[dict[str, Any]]:
    if not isinstance(raw_runs, list):
        raise ValueError("workflow_runs must be a list")
    operational_runs = [
        run
        for run in raw_runs
        if isinstance(run, dict)
        and isinstance(run.get("id"), int)
        and isinstance(run.get("updated_at"), str)
        and run.get("status") == "completed"
        and not str(run.get("display_title") or "").startswith("[테스트]")
    ]
    if recent_days is not None:
        if recent_days <= 0:
            raise ValueError("recent_days must be positive")
        cutoff = (now or datetime.now(timezone.utc)) - timedelta(days=recent_days)
        operational_runs = [
            run
            for run in operational_runs
            if (updated_at := parse_run_timestamp(run["updated_at"])) is not None
            and updated_at >= cutoff
        ]
    return operational_runs


def filter_smoke_runs(
    runs: list[dict[str, Any]],
    *,
    search: str,
    status_filter: str,
    cancellation_reason_filter: str = "all",
) -> list[dict[str, Any]]:
    if status_filter not in {"all", "success", "failure", "cancelled"}:
        raise ValueError("unsupported status filter")
    if cancellation_reason_filter not in _CANCELLATION_REASON_FILTERS:
        raise ValueError("unsupported cancellation reason filter")
    needle = normalize_history_search(search).casefold()
    return [
        run
        for run in runs
        if (
            status_filter == "all"
            or (
                status_filter == "success"
                and run.get("conclusion") in {"success", "skipped"}
            )
            or (status_filter == "failure" and is_failed_smoke_run(run))
            or (status_filter == "cancelled" and is_cancelled_smoke_run(run))
        )
        and (
            cancellation_reason_filter == "all"
            or classify_smoke_cancellation_reason(run, runs)
            == cancellation_reason_filter
        )
        and (
            not needle
            or any(
                needle in str(run.get(key) or "").casefold()
                for key in ("run_number", "head_sha")
            )
        )
    ]


def paginate_smoke_runs(
    runs: list[dict[str, Any]],
    *,
    page: int,
) -> tuple[list[dict[str, Any]], int, int]:
    if page < 1:
        raise ValueError("page must be positive")
    total = len(runs)
    start = (page - 1) * RECENT_RUN_LIMIT
    return (
        runs[start : start + RECENT_RUN_LIMIT],
        total,
        (total + RECENT_RUN_LIMIT - 1) // RECENT_RUN_LIMIT,
    )


def needs_job_details(run: dict[str, Any]) -> bool:
    if is_cancelled_smoke_run(run):
        return False
    return run.get("event") == "schedule" or run.get("conclusion") != "success"


def is_cancelled_smoke_run(run: dict[str, Any]) -> bool:
    return _clean_text(run.get("conclusion")) in _CANCELLED_CONCLUSIONS


def is_failed_smoke_run(run: dict[str, Any]) -> bool:
    conclusion = _clean_text(run.get("conclusion"))
    return conclusion not in {"success", "skipped", *_CANCELLED_CONCLUSIONS}


def normalize_history_search(value: str | None) -> str:
    return (value or "").strip()[:100]


def _find_step(
    steps: list[dict[str, Any]],
    name: str,
) -> dict[str, Any] | None:
    return next((step for step in steps if step.get("name") == name), None)


def _clean_text(value: object) -> str | None:
    text = str(value).strip() if value is not None else ""
    return text or None


def _run_started_at(run: dict[str, Any]) -> datetime | None:
    return _timestamp(run.get("run_started_at")) or _timestamp(run.get("created_at"))


def _timestamp(value: object) -> datetime | None:
    return parse_run_timestamp(value) if isinstance(value, str) else None
