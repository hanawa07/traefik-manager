from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import SQLiteSystemSettingsRepository


async def get_bool_setting(
    repo: SQLiteSystemSettingsRepository,
    key: str,
    *,
    default: bool,
) -> bool:
    value = await repo.get(key)
    if value is None:
        return default
    return value.strip().lower() == "true"


async def get_int_setting(
    repo: SQLiteSystemSettingsRepository,
    key: str,
    *,
    default: int,
) -> int:
    value = await repo.get(key)
    if value is None:
        return default
    try:
        return int(value.strip())
    except ValueError:
        return default


async def get_turnstile_mode(repo: SQLiteSystemSettingsRepository) -> str:
    stored_mode = ((await repo.get("login_turnstile_mode")) or "").strip().lower()
    if stored_mode in {"off", "always", "risk_based"}:
        return stored_mode

    legacy_enabled = await get_bool_setting(repo, "login_turnstile_enabled", default=False)
    return "always" if legacy_enabled else "off"


def split_domain_suffixes(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.replace(",", "\n").splitlines() if item.strip()]


def split_networks(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.replace(",", "\n").splitlines() if item.strip()]
