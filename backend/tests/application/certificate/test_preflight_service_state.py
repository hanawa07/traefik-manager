import pytest

from app.application.certificate import preflight_service
from app.core.certificate_diagnostics import CertificateDiagnosticsSettings
from tests.application.certificate.preflight_service_fakes import (
    StubAuditDb,
    make_preflight_log,
    utc_dt,
)


@pytest.mark.asyncio
async def test_get_certificate_preflight_state_uses_runtime_config_override():
    logs = [
        make_preflight_log(checked_at=utc_dt(12), resource_name="example.com"),
        make_preflight_log(checked_at=utc_dt(11, 55), resource_name="example.com"),
    ]

    state = await preflight_service.get_certificate_preflight_state(
        StubAuditDb(logs),
        config=CertificateDiagnosticsSettings(
            auto_check_interval_minutes=60,
            repeat_alert_threshold=2,
            repeat_alert_window_minutes=240,
            repeat_alert_cooldown_minutes=240,
        ),
    )

    assert state["example.com"]["failure_streak"] == 2
    assert state["example.com"]["repeated_failure_active"] is True
