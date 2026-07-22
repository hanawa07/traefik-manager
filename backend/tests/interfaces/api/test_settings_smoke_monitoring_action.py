import pytest
from pydantic import ValidationError

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
            monitoring_failure_rate_threshold_percent=45,
            monitoring_failure_rate_min_runs=5,
            monitoring_failure_rate_window_days=30,
            monitoring_github_rate_limit_alert_enabled=True,
            monitoring_github_primary_limit_alert_threshold=4,
            monitoring_github_secondary_limit_alert_threshold=2,
            monitoring_github_rate_limit_alert_window_hours=12,
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
    assert response.monitoring_failure_rate_threshold_percent == 45
    assert response.monitoring_failure_rate_min_runs == 5
    assert response.monitoring_failure_rate_window_days == 30
    assert response.monitoring_github_rate_limit_alert_enabled is True
    assert response.monitoring_github_primary_limit_alert_threshold == 4
    assert response.monitoring_github_secondary_limit_alert_threshold == 2
    assert response.monitoring_github_rate_limit_alert_window_hours == 12
    assert repo.values["dashboard_smoke_monitoring_enabled"] == "false"
    assert repo.values["dashboard_smoke_monitoring_frequency"] == "weekly"
    assert repo.values["dashboard_smoke_failure_rate_threshold_percent"] == "45"
    assert repo.values["dashboard_smoke_failure_rate_min_runs"] == "5"
    assert repo.values["dashboard_smoke_failure_rate_window_days"] == "30"
    assert repo.values["dashboard_smoke_github_rate_limit_alert_enabled"] == "true"
    assert repo.values["dashboard_smoke_github_primary_limit_alert_threshold"] == "4"
    assert repo.values["dashboard_smoke_github_secondary_limit_alert_threshold"] == "2"
    assert repo.values["dashboard_smoke_github_rate_limit_alert_window_hours"] == "12"
    assert audit.records[0]["detail"]["event"] == "settings_update_smoke_monitoring"
    assert audit.records[0]["detail"]["changed_keys"] == [
        "monitoring_enabled",
        "monitoring_failure_rate_min_runs",
        "monitoring_failure_rate_threshold_percent",
        "monitoring_failure_rate_window_days",
        "monitoring_frequency",
        "monitoring_github_primary_limit_alert_threshold",
        "monitoring_github_rate_limit_alert_enabled",
        "monitoring_github_rate_limit_alert_window_hours",
        "monitoring_github_secondary_limit_alert_threshold",
    ]


@pytest.mark.parametrize(
    ("threshold", "min_runs"),
    [(0, 3), (101, 3), (30, 0), (30, 31)],
)
def test_smoke_monitoring_settings_rejects_invalid_failure_rate_rule(
    threshold: int,
    min_runs: int,
) -> None:
    with pytest.raises(ValidationError):
        SmokeMonitoringSettingsUpdateRequest(
            monitoring_enabled=True,
            monitoring_frequency="daily",
            monitoring_failure_rate_threshold_percent=threshold,
            monitoring_failure_rate_min_runs=min_runs,
        )


@pytest.mark.parametrize("window_days", [1, 90])
def test_smoke_monitoring_settings_rejects_invalid_failure_rate_window(
    window_days: int,
) -> None:
    with pytest.raises(ValidationError):
        SmokeMonitoringSettingsUpdateRequest(
            monitoring_enabled=True,
            monitoring_frequency="daily",
            monitoring_failure_rate_window_days=window_days,
        )


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("monitoring_github_primary_limit_alert_threshold", 0),
        ("monitoring_github_secondary_limit_alert_threshold", 101),
        ("monitoring_github_rate_limit_alert_window_hours", 0),
        ("monitoring_github_rate_limit_alert_window_hours", 169),
    ],
)
def test_smoke_monitoring_settings_rejects_invalid_github_alert_rule(
    field: str,
    value: int,
) -> None:
    with pytest.raises(ValidationError):
        SmokeMonitoringSettingsUpdateRequest(
            monitoring_enabled=True,
            monitoring_frequency="daily",
            **{field: value},
        )
