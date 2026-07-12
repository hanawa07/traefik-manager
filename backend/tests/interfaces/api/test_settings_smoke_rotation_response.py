from datetime import datetime, timezone

import pytest

from app.interfaces.api.v1.routers.settings_smoke_rotation_response import (
    get_smoke_rotation_status_response,
)


class StubRepository:
    values: dict[str, str] = {}

    def __init__(self, _db):
        pass

    async def get(self, key: str) -> str | None:
        return self.values.get(key)


class StubHistoryReader:
    force_refresh = False

    async def get_history(self, _source_url: str, *, force_refresh: bool = False) -> dict:
        self.force_refresh = force_refresh
        return {
            "runs": [
                {
                    "status": "failure",
                    "completed_at": "2026-07-11T06:54:58Z",
                    "run_url": "https://github.com/hanawa07/traefik-manager/actions/runs/456",
                    "run_number": 78,
                    "commit_sha": "b3a4642",
                    "summary": "실패 단계: 운영 로그인·화면 검사",
                    "notification_suppressed": True,
                    "artifact_url": "https://github.com/example/artifact",
                    "artifact_expires_at": "2026-07-18T06:54:58Z",
                }
            ],
            "latest_failure": {
                "status": "failure",
                "completed_at": "2026-07-11T06:54:58Z",
                "run_url": "https://github.com/hanawa07/traefik-manager/actions/runs/456",
                "run_number": 78,
                "commit_sha": "b3a4642",
                "summary": "실패 단계: 운영 로그인·화면 검사",
                "notification_suppressed": True,
                "artifact_url": "https://github.com/example/artifact",
                "artifact_expires_at": "2026-07-18T06:54:58Z",
            },
            "checked_at": "2026-07-13T01:00:00+00:00",
            "error": None,
        }


@pytest.mark.asyncio
async def test_get_smoke_rotation_status_returns_saved_result() -> None:
    StubRepository.values = {
        "dashboard_smoke_monitoring_enabled": "false",
        "dashboard_smoke_monitoring_frequency": "weekly",
        "dashboard_smoke_last_success_at": "2026-07-11T06:59:00+00:00",
        "dashboard_smoke_last_run_url": "https://github.com/hanawa07/traefik-manager/actions/runs/123",
        "smoke_viewer_rotation_status": "failure",
        "smoke_viewer_rotation_last_attempt_at": "2026-07-10T04:17:00+00:00",
        "smoke_viewer_rotation_last_success_at": "2026-06-01T04:17:00+00:00",
        "smoke_viewer_rotation_detail": "GitHub secret 갱신",
    }

    result = await get_smoke_rotation_status_response(
        object(),
        settings_repository_factory=StubRepository,
        now=datetime(2026, 7, 10, tzinfo=timezone.utc),
    )

    assert result.status == "failure"
    assert result.monitoring_enabled is False
    assert result.monitoring_frequency == "weekly"
    assert result.monitoring_schedule_time == "03:17"
    assert result.monitoring_schedule_timezone == "Asia/Seoul"
    assert result.monitoring_last_success_at == "2026-07-11T06:59:00+00:00"
    assert result.monitoring_last_run_url.endswith("/actions/runs/123")
    assert result.monitoring_workflow_url.endswith("/actions/workflows/dashboard-visual-smoke.yml")
    assert result.last_attempt_at == "2026-07-10T04:17:00+00:00"
    assert result.last_success_at == "2026-06-01T04:17:00+00:00"
    assert result.detail == "GitHub secret 갱신"
    assert result.is_stale is True
    assert result.stale_after_days == 35


@pytest.mark.asyncio
async def test_get_smoke_rotation_status_defaults_to_never() -> None:
    StubRepository.values = {
        "dashboard_smoke_monitoring_frequency": "hourly",
        "smoke_viewer_rotation_status": "unexpected",
    }

    result = await get_smoke_rotation_status_response(
        object(),
        settings_repository_factory=StubRepository,
    )

    assert result.status == "never"
    assert result.is_stale is False
    assert result.monitoring_enabled is True
    assert result.monitoring_frequency == "daily"
    assert result.monitoring_last_success_at is None
    assert result.monitoring_last_run_url is None


@pytest.mark.asyncio
async def test_get_smoke_rotation_status_keeps_recent_success_fresh() -> None:
    StubRepository.values = {
        "smoke_viewer_rotation_status": "success",
        "smoke_viewer_rotation_last_success_at": "2026-07-01T04:17:00+00:00",
    }

    result = await get_smoke_rotation_status_response(
        object(),
        settings_repository_factory=StubRepository,
        now=datetime(2026, 7, 10, tzinfo=timezone.utc),
    )

    assert result.status == "success"
    assert result.is_stale is False


@pytest.mark.asyncio
async def test_get_smoke_rotation_status_hides_logs_by_default(tmp_path, monkeypatch) -> None:
    log_path = tmp_path / "rotation.log"
    log_path.write_text("민감할 수 있는 운영 로그\n", encoding="utf-8")
    monkeypatch.setattr(
        "app.interfaces.api.v1.routers.settings_smoke_rotation_response.settings.SMOKE_ROTATION_LOG_PATH",
        str(log_path),
    )
    StubRepository.values = {}

    result = await get_smoke_rotation_status_response(
        object(),
        settings_repository_factory=StubRepository,
    )

    assert result.recent_log_lines == []
    assert result.log_updated_at is None


@pytest.mark.asyncio
async def test_get_smoke_rotation_status_includes_logs_for_admin(tmp_path, monkeypatch) -> None:
    log_path = tmp_path / "rotation.log"
    log_path.write_text("회전 완료\n", encoding="utf-8")
    monkeypatch.setattr(
        "app.interfaces.api.v1.routers.settings_smoke_rotation_response.settings.SMOKE_ROTATION_LOG_PATH",
        str(log_path),
    )
    StubRepository.values = {}

    result = await get_smoke_rotation_status_response(
        object(),
        settings_repository_factory=StubRepository,
        include_recent_logs=True,
    )

    assert result.recent_log_lines == ["회전 완료"]
    assert result.log_updated_at is not None


@pytest.mark.asyncio
async def test_get_smoke_rotation_status_includes_remote_history_for_admin() -> None:
    StubRepository.values = {}
    history_reader = StubHistoryReader()

    result = await get_smoke_rotation_status_response(
        object(),
        settings_repository_factory=StubRepository,
        include_monitoring_history=True,
        force_refresh_monitoring_history=True,
        history_reader=history_reader,
    )

    assert result.monitoring_recent_runs[0].status == "failure"
    assert result.monitoring_recent_runs[0].notification_suppressed is True
    assert result.monitoring_recent_runs[0].artifact_url.endswith("/artifact")
    assert result.monitoring_recent_runs[0].artifact_expires_at == "2026-07-18T06:54:58Z"
    assert result.monitoring_latest_failure.run_number == 78
    assert result.monitoring_history_checked_at == "2026-07-13T01:00:00+00:00"
    assert result.monitoring_history_error is None
    assert history_reader.force_refresh is True
