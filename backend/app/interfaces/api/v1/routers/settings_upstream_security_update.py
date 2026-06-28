from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import SQLiteSystemSettingsRepository
from app.interfaces.api.v1.routers.settings_response_builders import build_upstream_security_response
from app.interfaces.api.v1.schemas.settings_schemas import (
    UpstreamSecuritySettingsResponse,
    UpstreamSecuritySettingsUpdateRequest,
)


async def update_upstream_security_settings_values(
    repo: SQLiteSystemSettingsRepository,
    request: UpstreamSecuritySettingsUpdateRequest,
) -> tuple[
    UpstreamSecuritySettingsResponse,
    UpstreamSecuritySettingsResponse,
    dict[str, object],
]:
    previous_response = await build_upstream_security_response(repo)
    await repo.set("upstream_dns_strict_mode", "true" if request.dns_strict_mode else "false")
    await repo.set("upstream_allowlist_enabled", "true" if request.allowlist_enabled else "false")
    await repo.set("upstream_allowed_domain_suffixes", "\n".join(request.allowed_domain_suffixes) or None)
    await repo.set(
        "upstream_allow_docker_service_names",
        "true" if request.allow_docker_service_names else "false",
    )
    await repo.set("upstream_allow_private_networks", "true" if request.allow_private_networks else "false")
    rollback_payload = {
        "dns_strict_mode": previous_response.dns_strict_mode,
        "allowlist_enabled": previous_response.allowlist_enabled,
        "allowed_domain_suffixes": previous_response.allowed_domain_suffixes,
        "allow_docker_service_names": previous_response.allow_docker_service_names,
        "allow_private_networks": previous_response.allow_private_networks,
    }
    return previous_response, await build_upstream_security_response(repo), rollback_payload
