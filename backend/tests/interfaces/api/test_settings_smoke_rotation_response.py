from datetime import datetime, timezone

import pytest

from app.interfaces.api.v1.routers.settings_smoke_rotation_response import (
    get_smoke_rotation_status_response,
)
from tests.interfaces.api.settings_router_fakes import StubSettingsRepository
from tests.interfaces.api.settings_smoke_rotation_response_fakes import (
    StubSmokeHistoryReader,
)


@pytest.mark.asyncio
async def test_get_smoke_rotation_status_returns_saved_result() -> None:
    StubSettingsRepository.store = {
        "dashboard_smoke_monitoring_enabled": "false",
        "dashboard_smoke_monitoring_frequency": "weekly",
        "dashboard_smoke_failure_rate_threshold_percent": "45",
        "dashboard_smoke_failure_rate_min_runs": "5",
        "dashboard_smoke_failure_rate_window_days": "30",
        "dashboard_smoke_last_success_at": "2026-07-11T06:59:00+00:00",
        "dashboard_smoke_last_run_url": "https://github.com/hanawa07/traefik-manager/actions/runs/123",
        "dashboard_smoke_admin_last_success_at": "2026-07-11T06:58:00+00:00",
        "dashboard_smoke_admin_last_run_url": "https://github.com/hanawa07/traefik-manager/actions/runs/122",
        "smoke_viewer_rotation_status": "failure",
        "smoke_viewer_rotation_last_attempt_at": "2026-07-10T04:17:00+00:00",
        "smoke_viewer_rotation_last_success_at": "2026-06-01T04:17:00+00:00",
        "smoke_viewer_rotation_detail": "GitHub secret 갱신",
    }

    result = await get_smoke_rotation_status_response(
        object(),
        settings_repository_factory=StubSettingsRepository,
        now=datetime(2026, 7, 10, tzinfo=timezone.utc),
    )

    assert result.status == "failure"
    assert result.monitoring_enabled is False
    assert result.monitoring_frequency == "weekly"
    assert result.monitoring_failure_rate_threshold_percent == 45
    assert result.monitoring_failure_rate_min_runs == 5
    assert result.monitoring_failure_rate_window_days == 30
    assert result.monitoring_schedule_time == "03:17"
    assert result.monitoring_schedule_timezone == "Asia/Seoul"
    assert result.monitoring_last_success_at == "2026-07-11T06:59:00+00:00"
    assert result.monitoring_last_run_url.endswith("/actions/runs/123")
    assert result.monitoring_admin_last_success_at == "2026-07-11T06:58:00+00:00"
    assert result.monitoring_admin_last_run_url.endswith("/actions/runs/122")
    assert result.monitoring_admin_is_stale is False
    assert result.monitoring_admin_stale_after_days == 8
    assert result.monitoring_workflow_url.endswith("/actions/workflows/dashboard-visual-smoke.yml")
    assert result.last_attempt_at == "2026-07-10T04:17:00+00:00"
    assert result.last_success_at == "2026-06-01T04:17:00+00:00"
    assert result.detail == "GitHub secret 갱신"
    assert result.is_stale is True
    assert result.stale_after_days == 35


@pytest.mark.asyncio
async def test_get_smoke_rotation_status_defaults_to_never() -> None:
    StubSettingsRepository.store = {
        "dashboard_smoke_monitoring_frequency": "hourly",
        "dashboard_smoke_failure_rate_threshold_percent": "101",
        "dashboard_smoke_failure_rate_min_runs": "invalid",
        "dashboard_smoke_failure_rate_window_days": "90",
        "smoke_viewer_rotation_status": "unexpected",
    }

    result = await get_smoke_rotation_status_response(
        object(),
        settings_repository_factory=StubSettingsRepository,
    )

    assert result.status == "never"
    assert result.is_stale is False
    assert result.monitoring_enabled is True
    assert result.monitoring_frequency == "daily"
    assert result.monitoring_failure_rate_threshold_percent == 30
    assert result.monitoring_failure_rate_min_runs == 3
    assert result.monitoring_failure_rate_window_days == 7
    assert result.monitoring_last_success_at is None
    assert result.monitoring_last_run_url is None
    assert result.monitoring_admin_last_success_at is None
    assert result.monitoring_admin_last_run_url is None
    assert result.monitoring_admin_is_stale is False
    assert result.monitoring_admin_stale_after_days == 2
    assert result.monitoring_statistics_snapshots == []
    assert result.monitoring_local_runs == []
    assert result.monitoring_local_run_total == 0
    assert result.monitoring_local_run_limit == 20


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("frequency", "last_success_at", "expected_days"),
    [
        ("daily", "2026-07-07T00:00:00+00:00", 2),
        ("weekly", "2026-07-01T00:00:00+00:00", 8),
    ],
)
async def test_get_smoke_rotation_status_warns_for_stale_admin_run(
    frequency: str,
    last_success_at: str,
    expected_days: int,
) -> None:
    StubSettingsRepository.store = {
        "dashboard_smoke_monitoring_frequency": frequency,
        "dashboard_smoke_admin_last_success_at": last_success_at,
    }

    result = await get_smoke_rotation_status_response(
        object(),
        settings_repository_factory=StubSettingsRepository,
        now=datetime(2026, 7, 10, tzinfo=timezone.utc),
    )

    assert result.monitoring_admin_is_stale is True
    assert result.monitoring_admin_stale_after_days == expected_days


@pytest.mark.asyncio
async def test_get_smoke_rotation_status_treats_invalid_admin_timestamp_as_stale() -> None:
    StubSettingsRepository.store = {
        "dashboard_smoke_admin_last_success_at": "invalid",
    }

    result = await get_smoke_rotation_status_response(
        object(),
        settings_repository_factory=StubSettingsRepository,
    )

    assert result.monitoring_admin_is_stale is True


@pytest.mark.asyncio
async def test_get_smoke_rotation_status_keeps_recent_success_fresh() -> None:
    StubSettingsRepository.store = {
        "smoke_viewer_rotation_status": "success",
        "smoke_viewer_rotation_last_success_at": "2026-07-01T04:17:00+00:00",
    }

    result = await get_smoke_rotation_status_response(
        object(),
        settings_repository_factory=StubSettingsRepository,
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
    StubSettingsRepository.store = {}

    result = await get_smoke_rotation_status_response(
        object(),
        settings_repository_factory=StubSettingsRepository,
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
    StubSettingsRepository.store = {}

    result = await get_smoke_rotation_status_response(
        object(),
        settings_repository_factory=StubSettingsRepository,
        include_recent_logs=True,
    )

    assert result.recent_log_lines == ["회전 완료"]
    assert result.log_updated_at is not None


@pytest.mark.asyncio
async def test_get_smoke_rotation_status_includes_remote_history_for_admin(monkeypatch) -> None:
    StubSettingsRepository.store = {
        "dashboard_smoke_failure_metadata": (
            '[{"run_id": 456, "captured_at": "2026-07-11T06:54:58Z", '
            '"check_name": "설정 화면 검사 실패", "screen_path": "/dashboard/settings", '
            '"page_title": "설정"}]'
        ),
        "dashboard_smoke_local_run_456": (
            '{"run_id":456,"status":"failure","started_at":"2026-07-13T00:58:00+00:00",'
            '"completed_at":"2026-07-13T01:00:00+00:00","duration_seconds":120,'
            '"admin_checked":false}'
        ),
    }
    history_reader = StubSmokeHistoryReader()
    monkeypatch.setattr(
        "app.interfaces.api.v1.routers.settings_smoke_rotation_response.read_github_api_rate_limit",
        lambda: {
            "remaining": 42,
            "limit": 60,
            "reset_at": "2026-07-21T07:00:00+00:00",
            "secondary_retry_at": "2026-07-21T06:05:00+00:00",
            "refresh_reserve": 8,
        },
    )
    monkeypatch.setattr(
        "app.interfaces.api.v1.routers.settings_smoke_rotation_response.read_smoke_history_cache_diagnostics",
        lambda: {"items": 7, "capacity": 200, "hits": 3, "misses": 1},
    )

    result = await get_smoke_rotation_status_response(
        object(),
        settings_repository_factory=StubSettingsRepository,
        include_monitoring_history=True,
        monitoring_history_days=30,
        monitoring_history_page=2,
        monitoring_history_search="456",
        monitoring_history_status="failure",
        force_refresh_monitoring_history=True,
        history_reader=history_reader,
        now=datetime(2026, 7, 13, tzinfo=timezone.utc),
    )

    assert result.monitoring_recent_runs[0].status == "failure"
    assert result.monitoring_recent_runs[0].run_id == 456
    assert result.monitoring_recent_runs[0].notification_suppressed is True
    assert result.monitoring_recent_runs[0].artifact_url.endswith("/artifact")
    assert result.monitoring_recent_runs[0].artifact_expires_at == "2026-07-18T06:54:58Z"
    assert result.monitoring_recent_runs[0].failure_metadata.check_name == "설정 화면 검사 실패"
    assert result.monitoring_recent_runs[0].failure_metadata.failure_type == "visual_regression"
    assert result.monitoring_recent_runs[0].failure_metadata.screen_path == "/dashboard/settings"
    assert result.monitoring_latest_failure.run_number == 78
    assert result.monitoring_run_statistics[0].estimated_runner_minutes == 14
    assert result.monitoring_statistics_snapshots[0].captured_on == "2026-07-13"
    assert result.monitoring_statistics_snapshots[0].estimated_runner_minutes == 60
    assert result.monitoring_local_runs[0].run_id == 456
    assert result.monitoring_local_runs[0].duration_seconds == 120
    assert result.monitoring_local_run_total == 1
    assert result.monitoring_local_run_limit == 20
    assert result.monitoring_local_run_retention_days == 365
    assert result.monitoring_history_checked_at == "2026-07-13T01:00:00+00:00"
    assert result.monitoring_history_data_checked_at == "2026-07-13T00:55:00+00:00"
    assert result.monitoring_history_error is None
    assert result.monitoring_history_days == 30
    assert result.monitoring_history_page == 2
    assert result.monitoring_history_total == 8
    assert result.monitoring_history_total_pages == 2
    assert result.monitoring_history_search == "456"
    assert result.monitoring_history_status == "failure"
    assert result.monitoring_history_cancellation_reason == "all"
    assert result.monitoring_failure_metadata_count == 1
    assert result.monitoring_failure_metadata_limit == 20
    assert result.monitoring_github_rate_limit_remaining == 42
    assert result.monitoring_github_rate_limit_limit == 60
    assert result.monitoring_github_rate_limit_reset_at == "2026-07-21T07:00:00+00:00"
    assert result.monitoring_github_secondary_limit_retry_at == "2026-07-21T06:05:00+00:00"
    assert result.monitoring_github_refresh_reserve == 8
    assert result.monitoring_github_history_cache_items == 7
    assert result.monitoring_github_history_cache_capacity == 200
    assert result.monitoring_github_history_cache_hits == 3
    assert result.monitoring_github_history_cache_misses == 1
    assert result.monitoring_github_last_request_count == 6
    assert result.monitoring_github_last_workflow_request_count == 1
    assert result.monitoring_github_last_job_request_count == 4
    assert result.monitoring_github_last_artifact_request_count == 1
    assert history_reader.force_refresh is True
    assert history_reader.recent_days == 30
    assert history_reader.page == 2
    assert history_reader.search == "456"
    assert history_reader.status_filter == "failure"
    assert history_reader.cancellation_reason_filter == "all"
