from collections.abc import Awaitable, Callable

from fastapi import HTTPException

from app.core.security import hash_basic_auth_password
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import SQLiteSystemSettingsRepository
from app.interfaces.api.v1.routers.settings_response_builders import build_traefik_dashboard_response
from app.interfaces.api.v1.schemas.settings_schemas import (
    TraefikDashboardSettingsResponse,
    TraefikDashboardSettingsUpdateRequest,
)


async def update_traefik_dashboard_settings_values(
    repo: SQLiteSystemSettingsRepository,
    request: TraefikDashboardSettingsUpdateRequest,
    ensure_domain_available: Callable[[str], Awaitable[None]],
) -> tuple[TraefikDashboardSettingsResponse, TraefikDashboardSettingsResponse, str]:
    previous_response = await build_traefik_dashboard_response(repo)
    existing_password_hash = await repo.get("traefik_dashboard_public_auth_password_hash")
    effective_password_hash = existing_password_hash or ""
    if request.auth_password:
        effective_password_hash = hash_basic_auth_password(request.auth_password)

    if request.enabled:
        if not request.domain or not request.auth_username:
            raise HTTPException(status_code=422, detail="공개 도메인과 기본 인증 사용자명이 필요합니다")
        if not effective_password_hash:
            raise HTTPException(status_code=422, detail="처음 활성화할 때는 기본 인증 비밀번호가 필요합니다")
        await ensure_domain_available(request.domain)

    await repo.set("traefik_dashboard_public_enabled", "true" if request.enabled else "false")
    await repo.set("traefik_dashboard_public_domain", request.domain or None)
    await repo.set("traefik_dashboard_public_auth_username", request.auth_username or None)
    if request.auth_password:
        await repo.set("traefik_dashboard_public_auth_password_hash", effective_password_hash)

    return previous_response, await build_traefik_dashboard_response(repo), effective_password_hash
