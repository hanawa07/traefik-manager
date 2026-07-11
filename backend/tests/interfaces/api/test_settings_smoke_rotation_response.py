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


@pytest.mark.asyncio
async def test_get_smoke_rotation_status_returns_saved_result() -> None:
    StubRepository.values = {
        "dashboard_smoke_monitoring_enabled": "false",
        "dashboard_smoke_monitoring_frequency": "weekly",
        "smoke_viewer_rotation_status": "failure",
        "smoke_viewer_rotation_last_attempt_at": "2026-07-10T04:17:00+00:00",
        "smoke_viewer_rotation_last_success_at": "2026-06-01T04:17:00+00:00",
        "smoke_viewer_rotation_detail": "GitHub secret 갱신",
        "dashboard_smoke_monitoring_enabled": "false",
        "dashboard_smoke_monitoring_frequency": "weekly",
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
    assert result.last_attempt_at == "2026-07-10T04:17:00+00:00"
    assert result.last_success_at == "2026-06-01T04:17:00+00:00"
    assert result.detail == "GitHub secret 갱신"
    assert result.is_stale is True
    assert result.stale_after_days == 35
    assert result.monitoring_enabled is False
    assert result.monitoring_frequency == "weekly"
    assert result.monitoring_schedule_time == "03:17"
    assert result.monitoring_schedule_timezone == "Asia/Seoul"


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
    assert result.monitoring_enabled is True
    assert result.monitoring_frequency == "daily"


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
