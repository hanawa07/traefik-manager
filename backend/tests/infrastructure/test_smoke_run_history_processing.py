from datetime import datetime, timezone

import pytest

from app.infrastructure.smoke_run_history_processing import (
    build_smoke_run_item,
    classify_smoke_cancellation_reason,
    paginate_smoke_runs,
    select_smoke_run_groups,
)


def _run(**overrides):
    return {
        "id": 123,
        "status": "completed",
        "conclusion": "success",
        "updated_at": "2026-07-11T07:31:58Z",
        "head_sha": "89327cb0a0d3c3435449b7c1284136fad350ccde",
        "run_number": 77,
        **overrides,
    }


def test_build_smoke_run_item_reports_failure_step_and_suppression() -> None:
    result = build_smoke_run_item(
        _run(conclusion="failure"),
        [
            {"name": "운영 로그인·화면 검사", "conclusion": "failure"},
            {"name": "반복 실패 알림 cooldown 확인", "conclusion": "success"},
            {"name": "Telegram 실패 알림", "conclusion": "skipped"},
        ],
        public_url="https://github.com/hanawa07/traefik-manager",
        artifact={
            "url": "https://github.com/example/artifact",
            "expires_at": "2026-07-18T06:54:58Z",
        },
    )

    assert result["status"] == "failure"
    assert result["run_id"] == 123
    assert result["summary"] == "실패 단계: 운영 로그인·화면 검사"
    assert result["notification_suppressed"] is True
    assert result["run_url"].endswith("/actions/runs/123")
    assert result["artifact_url"].endswith("/artifact")
    assert result["artifact_expires_at"] == "2026-07-18T06:54:58Z"


def test_build_smoke_run_item_distinguishes_skipped_schedule() -> None:
    result = build_smoke_run_item(
        _run(),
        [{"name": "운영 로그인·화면 검사", "conclusion": "skipped"}],
        public_url="https://github.com/hanawa07/traefik-manager",
    )

    assert result["status"] == "skipped"
    assert result["summary"] == "예약 설정에 따라 점검을 건너뜀"
    assert result["notification_suppressed"] is False

    github_skipped = build_smoke_run_item(
        _run(conclusion="skipped"),
        [],
        public_url="https://github.com/hanawa07/traefik-manager",
    )
    assert github_skipped["status"] == "skipped"


@pytest.mark.parametrize(
    ("conclusion", "expected_reason"),
    [("cancelled", "manual_or_unknown"), ("timed_out", "timeout")],
)
def test_build_smoke_run_item_excludes_cancelled_run_from_app_failures(
    conclusion: str,
    expected_reason: str,
) -> None:
    result = build_smoke_run_item(
        _run(conclusion=conclusion),
        [{"name": "운영 로그인·화면 검사", "conclusion": conclusion}],
        public_url="https://github.com/hanawa07/traefik-manager",
        artifact={
            "url": "https://github.com/example/artifact",
            "expires_at": "2026-07-18T06:54:58Z",
        },
    )

    assert result["status"] == "cancelled"
    assert result["cancellation_reason"] == expected_reason
    assert result["summary"].endswith("앱 실패율 제외")
    assert result["notification_suppressed"] is False
    assert result["artifact_url"] is None
    assert result["artifact_expires_at"] is None


def test_classify_smoke_cancellation_reason_detects_superseding_run() -> None:
    cancelled = _run(
        id=20,
        conclusion="cancelled",
        created_at="2026-07-11T07:00:00Z",
        run_started_at="2026-07-11T07:00:05Z",
        updated_at="2026-07-11T07:03:00Z",
    )
    newer = _run(
        id=21,
        created_at="2026-07-11T07:02:00Z",
        run_started_at="2026-07-11T07:02:05Z",
        updated_at="2026-07-11T07:04:00Z",
    )

    assert classify_smoke_cancellation_reason(cancelled, [cancelled, newer]) == "superseded"
    assert classify_smoke_cancellation_reason(cancelled, [cancelled]) == "manual_or_unknown"
    assert classify_smoke_cancellation_reason(_run(conclusion="timed_out"), []) == "timeout"
    assert classify_smoke_cancellation_reason(_run(), []) is None


def test_select_smoke_run_groups_keeps_latest_failure_outside_recent_five() -> None:
    runs = [
        _run(id=run_id, run_number=run_id, conclusion="success")
        for run_id in range(10, 4, -1)
    ]
    runs.append(_run(id=4, run_number=4, conclusion="failure"))

    recent, latest_failure = select_smoke_run_groups(runs)

    assert [run["id"] for run in recent] == [10, 9, 8, 7, 6]
    assert latest_failure["id"] == 4


def test_select_smoke_run_groups_excludes_test_runs_from_default_history() -> None:
    runs = [
        _run(id=12, conclusion="failure", display_title="[테스트] 실패 알림"),
        _run(id=11),
        _run(id=10, conclusion="failure"),
    ]

    recent, latest_failure = select_smoke_run_groups(runs)

    assert [run["id"] for run in recent] == [11, 10]
    assert latest_failure["id"] == 10


def test_select_smoke_run_groups_filters_requested_day_range() -> None:
    runs = [
        _run(id=10, updated_at="2026-07-17T00:00:00Z"),
        _run(id=9, updated_at="2026-07-11T00:00:00Z", conclusion="failure"),
        _run(id=8, updated_at="2026-06-17T00:00:00Z", conclusion="failure"),
        _run(id=7, updated_at="invalid"),
        _run(id=6, updated_at="2026-07-16T00:00:00Z", display_title="[테스트] 알림"),
    ]

    recent, latest_failure = select_smoke_run_groups(
        runs,
        recent_days=7,
        now=datetime(2026, 7, 18, tzinfo=timezone.utc),
    )

    assert [run["id"] for run in recent] == [10, 9]
    assert latest_failure["id"] == 9


def test_select_smoke_run_groups_filters_search_and_status_before_paging() -> None:
    runs = [
        _run(id=12, run_number=900, head_sha="abc1234", conclusion="failure"),
        _run(id=11, run_number=901, head_sha="def5678", conclusion="success"),
        _run(id=10, run_number=902, head_sha="abc9999", conclusion="success"),
    ]

    filtered, latest_failure = select_smoke_run_groups(
        runs,
        recent_days=30,
        now=datetime(2026, 7, 18, tzinfo=timezone.utc),
        search="ABC",
        status_filter="failure",
    )

    assert [run["id"] for run in filtered] == [12]
    assert latest_failure["id"] == 12


def test_select_smoke_run_groups_separates_cancelled_runs_from_failures() -> None:
    runs = [
        _run(id=13, run_number=903, conclusion="cancelled"),
        _run(id=12, run_number=902, conclusion="failure"),
        _run(id=11, run_number=901, conclusion="success"),
    ]

    cancelled, latest_failure = select_smoke_run_groups(
        runs,
        recent_days=30,
        now=datetime(2026, 7, 18, tzinfo=timezone.utc),
        status_filter="cancelled",
    )
    failures, _ = select_smoke_run_groups(
        runs,
        recent_days=30,
        now=datetime(2026, 7, 18, tzinfo=timezone.utc),
        status_filter="failure",
    )

    assert [run["id"] for run in cancelled] == [13]
    assert [run["id"] for run in failures] == [12]
    assert latest_failure["id"] == 12


def test_select_smoke_run_groups_filters_cancellation_reason() -> None:
    superseded = _run(
        id=13,
        conclusion="cancelled",
        run_started_at="2026-07-17T00:00:00Z",
        updated_at="2026-07-17T00:03:00Z",
    )
    newer = _run(
        id=14,
        run_started_at="2026-07-17T00:02:00Z",
        updated_at="2026-07-17T00:04:00Z",
    )
    timed_out = _run(id=12, conclusion="timed_out")

    filtered, _ = select_smoke_run_groups(
        [newer, superseded, timed_out],
        recent_days=30,
        now=datetime(2026, 7, 18, tzinfo=timezone.utc),
        status_filter="cancelled",
        cancellation_reason_filter="superseded",
    )

    assert [run["id"] for run in filtered] == [13]


def test_paginate_smoke_runs_returns_requested_five_item_page() -> None:
    runs = [_run(id=run_id) for run_id in range(12, 0, -1)]

    page, total, total_pages = paginate_smoke_runs(runs, page=2)

    assert [run["id"] for run in page] == [7, 6, 5, 4, 3]
    assert total == 12
    assert total_pages == 3
