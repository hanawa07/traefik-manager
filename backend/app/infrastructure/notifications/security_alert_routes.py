from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import (
    SQLiteSystemSettingsRepository,
)

SECURITY_ALERT_EVENTS = {"login_locked", "login_suspicious", "login_blocked_ip"}
SECURITY_ALERT_PROVIDERS = {"generic", "slack", "discord", "telegram", "teams", "pagerduty", "email"}
SECURITY_ALERT_ROUTE_TARGETS = {"default", "disabled", "telegram", "pagerduty", "email"}
CHANGE_ALERT_GROUPS = {
    "settings_change",
    "service_change",
    "redirect_change",
    "middleware_change",
    "user_change",
    "certificate_status_change",
    "certificate_preflight_failure",
    "rollback",
}


async def get_alert_context(repo: SQLiteSystemSettingsRepository, event: str) -> tuple[str, str] | None:
    category_and_group = get_alert_category_and_group(event)
    if category_and_group is None:
        return None
    category, route_group = category_and_group

    enabled_key = "security_alerts_enabled" if category == "security" else "change_alerts_enabled"
    enabled = await get_bool_setting(repo, enabled_key, default=False)
    if not enabled:
        return None

    default_provider = ((await repo.get("security_alert_provider")) or "generic").strip().lower()
    if default_provider not in SECURITY_ALERT_PROVIDERS:
        default_provider = "generic"

    if category == "security":
        route_target = ((await repo.get(f"security_alert_route_{route_group}")) or "default").strip().lower()
    else:
        route_target = await get_change_route_target(repo, route_group)
    if route_target not in SECURITY_ALERT_ROUTE_TARGETS:
        route_target = "default"
    if route_target == "disabled":
        return None
    if route_target == "default":
        return category, default_provider
    return category, route_target


def get_alert_category_and_group(event: str) -> tuple[str, str] | None:
    if event in SECURITY_ALERT_EVENTS:
        return "security", event
    if event.startswith("settings_update_"):
        return "change", "settings_change"
    if event == "smoke_rotation_failed":
        return "change", "settings_change"
    if event in {"service_create", "service_update", "service_delete"}:
        return "change", "service_change"
    if event in {"redirect_create", "redirect_update", "redirect_delete"}:
        return "change", "redirect_change"
    if event in {"middleware_create", "middleware_update", "middleware_delete"}:
        return "change", "middleware_change"
    if event in {"user_create", "user_update", "user_delete"}:
        return "change", "user_change"
    if event in {"certificate_warning", "certificate_error", "certificate_recovered"}:
        return "change", "certificate_status_change"
    if event == "certificate_preflight_repeated_failure":
        return "change", "certificate_preflight_failure"
    if event.endswith("_rollback") or event.startswith("settings_rollback_"):
        return "change", "rollback"
    return None


async def get_change_route_target(repo: SQLiteSystemSettingsRepository, route_group: str) -> str:
    stored_route = ((await repo.get(f"security_alert_change_route_{route_group}")) or "").strip().lower()
    if stored_route:
        return stored_route
    if route_group in {"certificate_status_change", "certificate_preflight_failure"}:
        legacy_route = ((await repo.get("security_alert_change_route_certificate_change")) or "").strip().lower()
        if legacy_route:
            return legacy_route
    return "default"


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
