from app.core.certificate_diagnostics import (
    CERTIFICATE_PREFLIGHT_AUTO_CHECK_INTERVAL_KEY,
    CERTIFICATE_PREFLIGHT_REPEAT_ALERT_COOLDOWN_KEY,
    CERTIFICATE_PREFLIGHT_REPEAT_ALERT_THRESHOLD_KEY,
    CERTIFICATE_PREFLIGHT_REPEAT_ALERT_WINDOW_KEY,
    build_certificate_diagnostics_settings,
)
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import SQLiteSystemSettingsRepository
from app.interfaces.api.v1.schemas.settings_schemas import CertificateDiagnosticsSettingsResponse


async def build_certificate_diagnostics_response(
    repo: SQLiteSystemSettingsRepository,
) -> CertificateDiagnosticsSettingsResponse:
    if callable(getattr(repo, "get_all_dict", None)):
        diagnostics_settings = build_certificate_diagnostics_settings(await repo.get_all_dict())
    else:
        diagnostics_settings = build_certificate_diagnostics_settings(
            {
                CERTIFICATE_PREFLIGHT_AUTO_CHECK_INTERVAL_KEY: await repo.get(
                    CERTIFICATE_PREFLIGHT_AUTO_CHECK_INTERVAL_KEY
                ),
                CERTIFICATE_PREFLIGHT_REPEAT_ALERT_THRESHOLD_KEY: await repo.get(
                    CERTIFICATE_PREFLIGHT_REPEAT_ALERT_THRESHOLD_KEY
                ),
                CERTIFICATE_PREFLIGHT_REPEAT_ALERT_WINDOW_KEY: await repo.get(
                    CERTIFICATE_PREFLIGHT_REPEAT_ALERT_WINDOW_KEY
                ),
                CERTIFICATE_PREFLIGHT_REPEAT_ALERT_COOLDOWN_KEY: await repo.get(
                    CERTIFICATE_PREFLIGHT_REPEAT_ALERT_COOLDOWN_KEY
                ),
            }
        )
    return CertificateDiagnosticsSettingsResponse(
        auto_check_interval_minutes=diagnostics_settings.auto_check_interval_minutes,
        repeat_alert_threshold=diagnostics_settings.repeat_alert_threshold,
        repeat_alert_window_minutes=diagnostics_settings.repeat_alert_window_minutes,
        repeat_alert_cooldown_minutes=diagnostics_settings.repeat_alert_cooldown_minutes,
    )
