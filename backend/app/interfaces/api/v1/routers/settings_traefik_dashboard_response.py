from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import SQLiteSystemSettingsRepository
from app.interfaces.api.v1.routers.settings_value_helpers import get_bool_setting
from app.interfaces.api.v1.schemas.settings_schemas import TraefikDashboardSettingsResponse


async def build_traefik_dashboard_response(
    repo: SQLiteSystemSettingsRepository,
) -> TraefikDashboardSettingsResponse:
    enabled = await get_bool_setting(
        repo,
        "traefik_dashboard_public_enabled",
        default=False,
    )
    domain = ((await repo.get("traefik_dashboard_public_domain")) or "").strip().lower() or None
    auth_username = ((await repo.get("traefik_dashboard_public_auth_username")) or "").strip() or None
    auth_password_hash = ((await repo.get("traefik_dashboard_public_auth_password_hash")) or "").strip()
    configured = bool(domain and auth_username and auth_password_hash)

    if enabled and configured:
        message = "필요할 때만 잠깐 공개하는 디버그 라우트로 사용하세요."
    elif enabled:
        message = "활성화되어 있지만 공개 도메인 또는 기본 인증 설정이 불완전합니다."
    else:
        message = "기본적으로 비공개입니다. 필요할 때만 임시로 열어두는 것을 권장합니다."

    return TraefikDashboardSettingsResponse(
        enabled=enabled,
        configured=configured,
        domain=domain,
        public_url=f"https://{domain}" if domain else None,
        auth_username=auth_username,
        auth_password_configured=bool(auth_password_hash),
        message=message,
    )
