from types import SimpleNamespace

import pytest

from app.infrastructure import manager_deployment_bottleneck
from app.interfaces.api.v1.routers import settings_deployment_bottleneck_router as router
from app.interfaces.api.v1.schemas.settings_deployment_schemas import (
    ManagerDeploymentBottleneckSettingsUpdateRequest,
)


@pytest.mark.asyncio
async def test_deployment_bottleneck_settings_persist_and_record_audit(monkeypatch, tmp_path):
    config_path = tmp_path / "bottleneck.conf"
    monkeypatch.setattr(
        manager_deployment_bottleneck.settings,
        "MANAGER_DEPLOYMENT_BOTTLENECK_CONFIG_PATH",
        str(config_path),
    )
    monkeypatch.setattr(router, "get_client_ip", lambda _: "203.0.113.10")
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(router.audit_service, "record", fake_record, raising=False)

    response = await router.update_deployment_bottleneck_settings(
        payload=ManagerDeploymentBottleneckSettingsUpdateRequest(
            threshold_ms=45_000,
            consecutive_count=4,
            event_retention_days=120,
        ),
        request=SimpleNamespace(),
        db=object(),
        actor={"username": "admin"},
    )

    assert response == {
        "threshold_ms": 45_000,
        "consecutive_count": 4,
        "event_retention_days": 120,
    }
    assert await router.get_deployment_bottleneck_settings(_={}) == response
    assert recorded[0]["detail"]["event"] == "settings_update_deployment_bottleneck"
    assert recorded[0]["detail"]["changed_keys"] == [
        "consecutive_count",
        "event_retention_days",
        "threshold_ms",
    ]

    compatible = await router.update_deployment_bottleneck_settings(
        payload=ManagerDeploymentBottleneckSettingsUpdateRequest(
            threshold_ms=50_000,
            consecutive_count=5,
        ),
        request=SimpleNamespace(),
        db=object(),
        actor={"username": "admin"},
    )
    assert compatible["event_retention_days"] == 120


@pytest.mark.asyncio
async def test_deployment_bottleneck_event_cleanup_uses_effective_retention_and_records_audit(
    monkeypatch,
):
    recorded = []
    cleanup_calls = []
    preview_calls = []
    cleanup_result = {
        "retention_days": 30,
        "deleted_count": 2,
        "retained_event_count": 3,
        "oldest_event_at": "2026-07-01T00:00:00Z",
        "newest_event_at": "2026-07-17T00:00:00Z",
    }
    monkeypatch.setattr(router, "get_client_ip", lambda _: "203.0.113.11")
    monkeypatch.setattr(
        router,
        "read_manager_deployment_bottleneck_state",
        lambda: {"effective_event_retention_days": 30},
    )

    def fake_cleanup(retention_days):
        cleanup_calls.append(retention_days)
        return cleanup_result

    def fake_preview(retention_days):
        preview_calls.append(retention_days)
        return cleanup_result

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(router, "prune_manager_deployment_bottleneck_events", fake_cleanup)
    monkeypatch.setattr(
        router,
        "preview_manager_deployment_bottleneck_event_cleanup",
        fake_preview,
    )
    monkeypatch.setattr(router.audit_service, "record", fake_record, raising=False)

    preview = await router.preview_deployment_bottleneck_event_cleanup(_={})

    result = await router.cleanup_deployment_bottleneck_events(
        request=SimpleNamespace(),
        db=object(),
        actor={"username": "admin"},
    )

    assert preview_calls == [30]
    assert preview["deleted_count"] == 2
    assert cleanup_calls == [30]
    assert result["deleted_count"] == 2
    assert recorded[0]["action"] == "cleanup"
    assert recorded[0]["detail"] == {
        "event": "deployment_bottleneck_events_cleanup",
        "retention_days": 30,
        "previous_event_count": 5,
        "deleted_count": 2,
        "retained_event_count": 3,
        "client_ip": "203.0.113.11",
    }
