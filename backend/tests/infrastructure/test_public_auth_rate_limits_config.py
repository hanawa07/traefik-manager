from pathlib import Path

import yaml


DYNAMIC_CONFIG_DIR = Path(__file__).parents[3] / "traefik-config" / "dynamic"


def load_config() -> dict:
    with (DYNAMIC_CONFIG_DIR / "public-auth-rate-limits.yml").open(
        encoding="utf-8"
    ) as config_file:
        return yaml.safe_load(config_file)["http"]


def test_hanaspace_credentials_login_has_edge_rate_limit() -> None:
    config = load_config()
    router = config["routers"]["hanaspace-credentials-login"]
    middleware = config["middlewares"]["hanaspace-credentials-login-rate-limit"]

    assert router["entryPoints"] == ["websecure"]
    assert router["priority"] == 1100
    assert router["rule"] == (
        "Host(`hanaspace.lizstudio.co.kr`) && "
        "Path(`/api/auth/callback/credentials`) && Method(`POST`)"
    )
    assert router["middlewares"] == ["hanaspace-credentials-login-rate-limit"]
    assert router["service"] == "hanaspace-lizstudio-co-kr@file"
    assert middleware["rateLimit"] == {
        "average": 10,
        "period": "1m",
        "burst": 5,
    }


def test_jellyfin_login_has_edge_rate_limit() -> None:
    config = load_config()
    router = config["routers"]["jellyfin-login"]
    middleware = config["middlewares"]["jellyfin-login-rate-limit"]

    assert router["entryPoints"] == ["websecure"]
    assert router["priority"] == 1100
    assert router["rule"] == (
        "Host(`jellyfin.lizstudio.co.kr`) && "
        "Path(`/Users/AuthenticateByName`) && Method(`POST`)"
    )
    assert router["middlewares"] == ["jellyfin-login-rate-limit"]
    assert router["service"] == "jellyfin-lizstudio-co-kr@file"
    assert middleware["rateLimit"] == {
        "average": 10,
        "period": "1m",
        "burst": 5,
    }
