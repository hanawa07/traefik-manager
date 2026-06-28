from app.core.certificate_diagnostics import (
    CERTIFICATE_PREFLIGHT_AUTO_CHECK_INTERVAL_KEY,
    CERTIFICATE_PREFLIGHT_REPEAT_ALERT_COOLDOWN_KEY,
    CERTIFICATE_PREFLIGHT_REPEAT_ALERT_THRESHOLD_KEY,
    CERTIFICATE_PREFLIGHT_REPEAT_ALERT_WINDOW_KEY,
)
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import SQLiteSystemSettingsRepository
from app.interfaces.api.v1.routers.settings_response_builders import build_certificate_diagnostics_response
from app.interfaces.api.v1.schemas.settings_schemas import (
    CertificateDiagnosticsSettingsResponse,
    CertificateDiagnosticsSettingsUpdateRequest,
)


async def update_certificate_diagnostics_settings_values(
    repo: SQLiteSystemSettingsRepository,
    request: CertificateDiagnosticsSettingsUpdateRequest,
) -> tuple[CertificateDiagnosticsSettingsResponse, CertificateDiagnosticsSettingsResponse]:
    previous_response = await build_certificate_diagnostics_response(repo)
    await repo.set(CERTIFICATE_PREFLIGHT_AUTO_CHECK_INTERVAL_KEY, str(request.auto_check_interval_minutes))
    await repo.set(CERTIFICATE_PREFLIGHT_REPEAT_ALERT_THRESHOLD_KEY, str(request.repeat_alert_threshold))
    await repo.set(CERTIFICATE_PREFLIGHT_REPEAT_ALERT_WINDOW_KEY, str(request.repeat_alert_window_minutes))
    await repo.set(CERTIFICATE_PREFLIGHT_REPEAT_ALERT_COOLDOWN_KEY, str(request.repeat_alert_cooldown_minutes))
    return previous_response, await build_certificate_diagnostics_response(repo)
