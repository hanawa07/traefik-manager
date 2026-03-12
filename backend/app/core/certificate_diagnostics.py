from collections.abc import Mapping
from dataclasses import dataclass

from app.core.config import settings

CERTIFICATE_PREFLIGHT_AUTO_CHECK_INTERVAL_KEY = "certificate_preflight_auto_check_interval_minutes"
CERTIFICATE_PREFLIGHT_REPEAT_ALERT_THRESHOLD_KEY = "certificate_preflight_repeat_alert_threshold"
CERTIFICATE_PREFLIGHT_REPEAT_ALERT_WINDOW_KEY = "certificate_preflight_repeat_alert_window_minutes"
CERTIFICATE_PREFLIGHT_REPEAT_ALERT_COOLDOWN_KEY = "certificate_preflight_repeat_alert_cooldown_minutes"


@dataclass(frozen=True)
class CertificateDiagnosticsSettings:
    auto_check_interval_minutes: int
    repeat_alert_threshold: int
    repeat_alert_window_minutes: int
    repeat_alert_cooldown_minutes: int


def build_certificate_diagnostics_settings(
    values: Mapping[str, str | None] | None = None,
) -> CertificateDiagnosticsSettings:
    raw_values = values or {}
    return CertificateDiagnosticsSettings(
        auto_check_interval_minutes=_parse_int_setting(
            raw_values.get(CERTIFICATE_PREFLIGHT_AUTO_CHECK_INTERVAL_KEY),
            default=settings.CERTIFICATE_PREFLIGHT_AUTO_CHECK_INTERVAL_MINUTES,
            minimum=5,
            maximum=1440,
        ),
        repeat_alert_threshold=_parse_int_setting(
            raw_values.get(CERTIFICATE_PREFLIGHT_REPEAT_ALERT_THRESHOLD_KEY),
            default=settings.CERTIFICATE_PREFLIGHT_REPEAT_ALERT_THRESHOLD,
            minimum=2,
            maximum=20,
        ),
        repeat_alert_window_minutes=_parse_int_setting(
            raw_values.get(CERTIFICATE_PREFLIGHT_REPEAT_ALERT_WINDOW_KEY),
            default=settings.CERTIFICATE_PREFLIGHT_REPEAT_ALERT_WINDOW_MINUTES,
            minimum=5,
            maximum=10080,
        ),
        repeat_alert_cooldown_minutes=_parse_int_setting(
            raw_values.get(CERTIFICATE_PREFLIGHT_REPEAT_ALERT_COOLDOWN_KEY),
            default=settings.CERTIFICATE_PREFLIGHT_REPEAT_ALERT_COOLDOWN_MINUTES,
            minimum=5,
            maximum=10080,
        ),
    )


def _parse_int_setting(value: str | None, *, default: int, minimum: int, maximum: int) -> int:
    if value is None:
        return default
    try:
        parsed = int(value.strip())
    except (TypeError, ValueError, AttributeError):
        return default
    if parsed < minimum or parsed > maximum:
        return default
    return parsed
