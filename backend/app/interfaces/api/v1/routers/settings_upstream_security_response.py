from app.domain.proxy.value_objects.upstream import normalize_domain_suffixes
from app.domain.proxy.value_objects.upstream_security_presets import (
    get_upstream_security_preset,
    infer_upstream_security_preset_key,
    list_upstream_security_presets,
)
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import SQLiteSystemSettingsRepository
from app.interfaces.api.v1.routers.settings_value_helpers import (
    get_bool_setting,
    split_domain_suffixes,
)
from app.interfaces.api.v1.schemas.settings_schemas import (
    UpstreamSecurityPresetResponse,
    UpstreamSecuritySettingsResponse,
)


async def build_upstream_security_response(
    repo: SQLiteSystemSettingsRepository,
) -> UpstreamSecuritySettingsResponse:
    dns_strict_mode = await get_bool_setting(repo, "upstream_dns_strict_mode", default=False)
    allowlist_enabled = await get_bool_setting(repo, "upstream_allowlist_enabled", default=False)
    allow_docker_service_names = await get_bool_setting(
        repo,
        "upstream_allow_docker_service_names",
        default=True,
    )
    allow_private_networks = await get_bool_setting(
        repo,
        "upstream_allow_private_networks",
        default=True,
    )
    preset_key = infer_upstream_security_preset_key(
        dns_strict_mode=dns_strict_mode,
        allowlist_enabled=allowlist_enabled,
        allow_docker_service_names=allow_docker_service_names,
        allow_private_networks=allow_private_networks,
    )
    preset = get_upstream_security_preset(preset_key)
    return UpstreamSecuritySettingsResponse(
        preset_key=preset.key,
        preset_name=preset.name,
        preset_description=preset.description,
        available_presets=[
            UpstreamSecurityPresetResponse(
                key=item.key,
                name=item.name,
                description=item.description,
                dns_strict_mode=item.dns_strict_mode,
                allowlist_enabled=item.allowlist_enabled,
                allow_docker_service_names=item.allow_docker_service_names,
                allow_private_networks=item.allow_private_networks,
            )
            for item in list_upstream_security_presets()
        ],
        dns_strict_mode=dns_strict_mode,
        allowlist_enabled=allowlist_enabled,
        allowed_domain_suffixes=normalize_domain_suffixes(
            split_domain_suffixes(await repo.get("upstream_allowed_domain_suffixes"))
        ),
        allow_docker_service_names=allow_docker_service_names,
        allow_private_networks=allow_private_networks,
    )
