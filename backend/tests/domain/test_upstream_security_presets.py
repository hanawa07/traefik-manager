from app.domain.proxy.value_objects.upstream_security_presets import (
    get_upstream_security_preset,
    infer_upstream_security_preset_key,
    list_upstream_security_presets,
)


def test_list_upstream_security_presets_exposes_supported_templates():
    presets = list_upstream_security_presets()

    assert [preset.key for preset in presets] == ["disabled", "internal-first", "external-only"]
    assert presets[1].dns_strict_mode is True
    assert presets[1].allowlist_enabled is True
    assert presets[1].allow_docker_service_names is True
    assert presets[1].allow_private_networks is True


def test_infer_upstream_security_preset_key_matches_known_configuration():
    assert infer_upstream_security_preset_key(
        dns_strict_mode=False,
        allowlist_enabled=False,
        allow_docker_service_names=True,
        allow_private_networks=True,
    ) == "disabled"
    assert infer_upstream_security_preset_key(
        dns_strict_mode=True,
        allowlist_enabled=True,
        allow_docker_service_names=True,
        allow_private_networks=True,
    ) == "internal-first"
    assert infer_upstream_security_preset_key(
        dns_strict_mode=True,
        allowlist_enabled=True,
        allow_docker_service_names=False,
        allow_private_networks=False,
    ) == "external-only"


def test_infer_upstream_security_preset_key_returns_custom_for_unmatched_policy():
    assert infer_upstream_security_preset_key(
        dns_strict_mode=True,
        allowlist_enabled=False,
        allow_docker_service_names=True,
        allow_private_networks=True,
    ) == "custom"


def test_get_upstream_security_preset_returns_metadata_for_known_key():
    preset = get_upstream_security_preset("internal-first")

    assert preset.key == "internal-first"
    assert "외부 FQDN" in preset.description
