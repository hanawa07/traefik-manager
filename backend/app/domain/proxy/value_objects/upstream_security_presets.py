from dataclasses import dataclass


@dataclass(frozen=True)
class UpstreamSecurityPreset:
    key: str
    name: str
    description: str
    dns_strict_mode: bool
    allowlist_enabled: bool
    allow_docker_service_names: bool
    allow_private_networks: bool


_PRESETS = (
    UpstreamSecurityPreset(
        key="disabled",
        name="정책 비활성화",
        description="현재 입력값 검증만 유지하고 DNS strict mode와 allowlist를 모두 끕니다.",
        dns_strict_mode=False,
        allowlist_enabled=False,
        allow_docker_service_names=True,
        allow_private_networks=True,
    ),
    UpstreamSecurityPreset(
        key="internal-first",
        name="내부 우선",
        description="Docker 서비스명과 사설망은 허용하고, 외부 FQDN은 suffix allowlist와 DNS strict mode로 제한합니다.",
        dns_strict_mode=True,
        allowlist_enabled=True,
        allow_docker_service_names=True,
        allow_private_networks=True,
    ),
    UpstreamSecurityPreset(
        key="external-only",
        name="외부 승인 도메인 전용",
        description="외부 FQDN만 허용하고, Docker 서비스명과 사설망 IP 리터럴은 차단합니다.",
        dns_strict_mode=True,
        allowlist_enabled=True,
        allow_docker_service_names=False,
        allow_private_networks=False,
    ),
)

_PRESET_BY_KEY = {preset.key: preset for preset in _PRESETS}


def list_upstream_security_presets() -> list[UpstreamSecurityPreset]:
    return list(_PRESETS)


def get_upstream_security_preset(key: str) -> UpstreamSecurityPreset:
    if key == "custom":
        return UpstreamSecurityPreset(
            key="custom",
            name="사용자 정의",
            description="기본 preset 조합과 다르게 세부 옵션을 직접 조정한 상태입니다.",
            dns_strict_mode=False,
            allowlist_enabled=False,
            allow_docker_service_names=True,
            allow_private_networks=True,
        )
    return _PRESET_BY_KEY[key]


def infer_upstream_security_preset_key(
    *,
    dns_strict_mode: bool,
    allowlist_enabled: bool,
    allow_docker_service_names: bool,
    allow_private_networks: bool,
) -> str:
    for preset in _PRESETS:
        if (
            preset.dns_strict_mode == dns_strict_mode
            and preset.allowlist_enabled == allowlist_enabled
            and preset.allow_docker_service_names == allow_docker_service_names
            and preset.allow_private_networks == allow_private_networks
        ):
            return preset.key
    return "custom"
