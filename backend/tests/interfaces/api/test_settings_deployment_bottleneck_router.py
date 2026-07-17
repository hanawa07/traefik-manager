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
