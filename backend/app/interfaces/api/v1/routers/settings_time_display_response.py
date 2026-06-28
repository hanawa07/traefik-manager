from app.core.time_display import (
    get_display_timezone_label,
    get_display_timezone_name,
    normalize_display_timezone,
)
from app.interfaces.api.v1.schemas.settings_schemas import TimeDisplaySettingsResponse


def build_time_display_response(
    display_timezone: str | None,
    server_context: dict[str, str],
) -> TimeDisplaySettingsResponse:
    normalized_timezone = normalize_display_timezone(display_timezone)
    return TimeDisplaySettingsResponse(
        display_timezone=normalized_timezone,
        display_timezone_name=get_display_timezone_name(normalized_timezone),
        display_timezone_label=get_display_timezone_label(normalized_timezone),
        storage_timezone=server_context["storage_timezone"],
        server_timezone_name=server_context["server_timezone_name"],
        server_timezone_label=server_context["server_timezone_label"],
        server_timezone_offset=server_context["server_timezone_offset"],
        server_time_iso=server_context["server_time_iso"],
    )
