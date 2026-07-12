import pytest

from app.infrastructure.smoke_run_history import (
    GitHubSmokeRunHistoryReader,
    build_smoke_artifacts,
    build_smoke_run_item,
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
    assert result["summary"] == "실패 단계: 운영 로그인·화면 검사"
    assert result["notification_suppressed"] is True
    assert result["run_url"].endswith("/actions/runs/123")
    assert result["artifact_url"].endswith("/artifact")
    assert result["artifact_expires_at"] == "2026-07-18T06:54:58Z"


def test_build_smoke_artifacts_accepts_only_active_matching_artifact() -> None:
    artifacts = build_smoke_artifacts(
        [
            {
                "id": 1,
                "name": "other",
                "expired": False,
                "workflow_run": {"id": 123},
            },
            {
                "id": 2,
                "name": "dashboard-visual-smoke-123",
                "expired": True,
                "workflow_run": {"id": 123},
            },
            {
                "id": 3,
                "name": "dashboard-visual-smoke-123",
                "expired": False,
                "expires_at": "2026-07-18T06:54:58Z",
                "workflow_run": {"id": 123},
            },
        ],
        run_ids={123},
        public_url="https://github.com/hanawa07/traefik-manager",
    )

    assert artifacts == {
        123: {
            "url": "https://github.com/hanawa07/traefik-manager/actions/runs/123/artifacts/3",
            "expires_at": "2026-07-18T06:54:58Z",
        }
    }


def test_build_smoke_run_item_distinguishes_skipped_schedule() -> None:
    result = build_smoke_run_item(
        _run(),
        [{"name": "운영 로그인·화면 검사", "conclusion": "skipped"}],
        public_url="https://github.com/hanawa07/traefik-manager",
    )

    assert result["status"] == "skipped"
    assert result["summary"] == "예약 설정에 따라 점검을 건너뜀"
    assert result["notification_suppressed"] is False


def test_select_smoke_run_groups_keeps_latest_failure_outside_recent_five() -> None:
    runs = [
        _run(id=run_id, run_number=run_id, conclusion="success")
        for run_id in range(10, 4, -1)
    ]
    runs.append(_run(id=4, run_number=4, conclusion="failure"))

    recent, latest_failure = select_smoke_run_groups(runs)

    assert [run["id"] for run in recent] == [10, 9, 8, 7, 6]
    assert latest_failure["id"] == 4


@pytest.mark.asyncio
async def test_history_reader_rejects_non_github_source_without_request() -> None:
    history = await GitHubSmokeRunHistoryReader().get_history("https://example.com/repository")

    assert history == {
        "runs": [],
        "latest_failure": None,
        "checked_at": None,
        "error": "GitHub 저장소 주소를 확인하지 못했습니다",
    }


@pytest.mark.asyncio
async def test_history_reader_force_refresh_bypasses_cache() -> None:
    class CountingReader(GitHubSmokeRunHistoryReader):
        calls = 0

        async def _fetch_history(self, _api_url: str, _public_url: str) -> dict:
            self.calls += 1
            return {"runs": [], "latest_failure": None, "error": None}

    reader = CountingReader()
    source_url = "https://github.com/hanawa07/traefik-manager-force-refresh-test"

    first = await reader.get_history(source_url)
    await reader.get_history(source_url)
    await reader.get_history(source_url, force_refresh=True)

    assert reader.calls == 2
    assert first["checked_at"] is not None
