from datetime import datetime, timezone

from app.infrastructure.smoke_run_statistics import build_smoke_run_statistics


def _run(**overrides):
    return {
        "id": 123,
        "status": "completed",
        "conclusion": "success",
        "updated_at": "2026-07-11T07:31:58Z",
        **overrides,
    }


def test_build_smoke_run_statistics_counts_status_and_duration_without_test_runs() -> None:
    runs = [
        _run(
            id=15,
            run_started_at="2026-07-17T00:00:00Z",
            updated_at="2026-07-17T00:01:01Z",
        ),
        _run(
            id=14,
            conclusion="failure",
            run_started_at="2026-07-16T00:00:00Z",
            updated_at="2026-07-16T00:02:00Z",
        ),
        _run(
            id=13,
            conclusion="timed_out",
            run_started_at="2026-07-15T00:00:00Z",
            updated_at="2026-07-15T00:00:30Z",
        ),
        _run(
            id=12,
            conclusion="skipped",
            run_started_at="2026-07-14T00:00:00Z",
            updated_at="2026-07-14T00:00:10Z",
        ),
        _run(
            id=11,
            run_started_at="2026-07-01T00:00:00Z",
            updated_at="2026-07-01T00:01:00Z",
        ),
        _run(id=10, display_title="[테스트] 사용량 fixture"),
    ]

    statistics = build_smoke_run_statistics(
        runs,
        now=datetime(2026, 7, 18, tzinfo=timezone.utc),
    )

    assert statistics == [
        {
            "window_days": 7,
            "total_count": 4,
            "success_count": 1,
            "failure_count": 1,
            "cancelled_count": 1,
            "skipped_count": 1,
            "duration_run_count": 4,
            "total_duration_seconds": 221,
            "average_duration_seconds": 55,
            "estimated_runner_minutes": 6,
        },
        {
            "window_days": 30,
            "total_count": 5,
            "success_count": 2,
            "failure_count": 1,
            "cancelled_count": 1,
            "skipped_count": 1,
            "duration_run_count": 5,
            "total_duration_seconds": 281,
            "average_duration_seconds": 56,
            "estimated_runner_minutes": 7,
        },
    ]
