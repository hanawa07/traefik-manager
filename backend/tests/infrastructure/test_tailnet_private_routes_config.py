from pathlib import Path

import yaml


DYNAMIC_CONFIG_DIR = Path(__file__).parents[3] / "traefik-config" / "dynamic"


def load_config(name: str) -> dict:
    with (DYNAMIC_CONFIG_DIR / name).open(encoding="utf-8") as config_file:
        return yaml.safe_load(config_file)


def test_manager_domain_is_limited_to_tailnet_clients() -> None:
    config = load_config("traefik-manager-private-domain.yml")["http"]
    middleware = config["middlewares"]["traefik-manager-private-domain-allowlist"]
    router = config["routers"]["traefik-manager-private-domain"]

    assert middleware["ipAllowList"]["sourceRange"] == ["100.64.0.0/10"]
    assert router["entryPoints"] == ["websecure"]
    assert router["service"] == "traefik-manager-frontend-file@file"
    assert router["middlewares"] == ["traefik-manager-private-domain-allowlist"]


def test_smarthome_only_exposes_webhook_path() -> None:
    config = load_config("smarthome-public-webhook.yml")["http"]
    router = config["routers"]["smarthome-public-webhook"]
    rate_limit = config["middlewares"]["smarthome-public-webhook-rate-limit"]

    assert router["rule"] == (
        "Host(`smarthome.lizstudio.co.kr`) && PathPrefix(`/api/webhook/`)"
    )
    assert router["priority"] == 1000
    assert router["middlewares"] == ["smarthome-public-webhook-rate-limit"]
    assert router["service"] == "smarthome-lizstudio-co-kr@file"
    assert rate_limit["rateLimit"] == {"average": 100, "burst": 200}
