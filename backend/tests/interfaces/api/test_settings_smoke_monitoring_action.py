import pytest

from app.interfaces.api.v1.routers.settings_smoke_monitoring_action import (
    update_smoke_monitoring_settings_action,
)
from app.interfaces.api.v1.schemas.settings_smoke_rotation_schemas import (
    SmokeMonitoringSettingsUpdateRequest,
)


class StubRepository:
    def __init__(self) -> None:
        self.values = {
            "dashboard_smoke_monitoring_enabled": "true",
            "dashboard_smoke_monitoring_frequency": "daily",
        }

    async def get(self, key: str) -> str | None:
        return self.values.get(key)

    async def set(self, key: str, value: str) -> None:
        self.values[key] = value


class StubAuditService:
    def __init__(self) -> None:
        self.records = []

    async def record(self, **kwargs) -> None:
        self.records.append(kwargs)


@pytest.mark.asyncio
async def test_update_smoke_monitoring_settings_records_change() -> None:
    repo = StubRepository()
    audit = StubAuditService()

    response = await update_smoke_monitoring_settings_action(
        request=SmokeMonitoringSettingsUpdateRequest(
            monitoring_enabled=False,
            monitoring_frequency="weekly",
        ),
        http_request=None,
        db=object(),
        actor={"username": "admin"},
        settings_repository_factory=lambda _db: repo,
        audit_service=audit,
        client_ip_getter=lambda _request: "127.0.0.1",
    )

    assert response.monitoring_enabled is False
    assert response.monitoring_frequency == "weekly"
    assert repo.values["dashboard_smoke_monitoring_enabled"] == "false"
    assert repo.values["dashboard_smoke_monitoring_frequency"] == "weekly"
    assert audit.records[0]["detail"]["event"] == "settings_update_smoke_monitoring"
    assert audit.records[0]["detail"]["changed_keys"] == [
        "monitoring_enabled",
        "monitoring_frequency",
    ]
