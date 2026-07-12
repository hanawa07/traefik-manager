import pytest

from app.infrastructure.smoke_run_history import (
    GitHubSmokeRunHistoryReader,
    build_smoke_run_item,
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
    )

    assert result["status"] == "failure"
    assert result["summary"] == "실패 단계: 운영 로그인·화면 검사"
    assert result["notification_suppressed"] is True
    assert result["run_url"].endswith("/actions/runs/123")


def test_build_smoke_run_item_distinguishes_skipped_schedule() -> None:
    result = build_smoke_run_item(
        _run(),
        [{"name": "운영 로그인·화면 검사", "conclusion": "skipped"}],
        public_url="https://github.com/hanawa07/traefik-manager",
    )

    assert result["status"] == "skipped"
    assert result["summary"] == "예약 설정에 따라 점검을 건너뜀"
    assert result["notification_suppressed"] is False


@pytest.mark.asyncio
async def test_history_reader_rejects_non_github_source_without_request() -> None:
    history = await GitHubSmokeRunHistoryReader().get_history("https://example.com/repository")

    assert history == {
        "runs": [],
        "error": "GitHub 저장소 주소를 확인하지 못했습니다",
    }
