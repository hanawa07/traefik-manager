from app.core.time_display import normalize_display_timezone
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import SQLiteSystemSettingsRepository


async def update_time_display_settings_value(
    repo: SQLiteSystemSettingsRepository,
    display_timezone: str,
) -> str:
    previous_value = normalize_display_timezone(await repo.get("display_timezone"))
    await repo.set("display_timezone", display_timezone)
    return previous_value
