import os
import subprocess
from pathlib import Path

import pytest
import yaml


PROJECT_ROOT = Path(__file__).resolve().parents[3]
SCRIPT_PATH = PROJECT_ROOT / "scripts" / "init-traefik-config.sh"


def render_config(tmp_path: Path, **overrides: str) -> dict:
    config_root = tmp_path / "traefik-config"
    env = {
        **os.environ,
        "FRONTEND_DOMAIN": "manager.example.com",
        "TRAEFIK_CONFIG_ROOT": str(config_root),
        **overrides,
    }
    subprocess.run(["sh", str(SCRIPT_PATH)], check=True, env=env)
    target = config_root / "dynamic" / "traefik-manager-self.yml"
    return yaml.safe_load(target.read_text(encoding="utf-8"))


def run_config(tmp_path: Path, **overrides: str) -> subprocess.CompletedProcess[str]:
    env = {
        **os.environ,
        "FRONTEND_DOMAIN": "manager.example.com",
        "TRAEFIK_CONFIG_ROOT": str(tmp_path / "traefik-config"),
        **overrides,
    }
    return subprocess.run(
        ["sh", str(SCRIPT_PATH)],
        check=False,
        env=env,
        capture_output=True,
        text=True,
    )


def test_default_config_keeps_only_public_routers(tmp_path: Path) -> None:
    config = render_config(tmp_path)

    routers = config["http"]["routers"]
    assert set(routers) == {
        "traefik-manager-frontend-file",
        "traefik-manager-frontend-http-file",
    }
    assert routers["traefik-manager-frontend-file"]["rule"] == (
        "Host(`manager.example.com`)"
    )
    assert config["http"]["services"]["traefik-manager-frontend-file"][
        "loadBalancer"
    ]["servers"] == [{"url": "http://traefik-manager-frontend:3000"}]


def test_config_can_publish_public_and_tailnet_routers(tmp_path: Path) -> None:
    config = render_config(
        tmp_path,
        TRAEFIK_MANAGER_TAILNET_ROUTER_ENABLED="true",
        TRAEFIK_MANAGER_FRONTEND_UPSTREAM=(
            "http://traefik-manager-frontend-green:3000"
        ),
    )

    routers = config["http"]["routers"]
    assert set(routers) == {
        "traefik-manager-frontend-file",
        "traefik-manager-frontend-http-file",
        "traefik-manager-tailnet-file",
    }
    assert routers["traefik-manager-tailnet-file"] == {
        "rule": "PathPrefix(`/`)",
        "entryPoints": ["manager-tailnet"],
        "middlewares": ["security-headers@file"],
        "service": "traefik-manager-frontend-file",
    }
    assert config["http"]["services"]["traefik-manager-frontend-file"][
        "loadBalancer"
    ]["servers"] == [{"url": "http://traefik-manager-frontend-green:3000"}]


def test_config_can_disable_public_routers(tmp_path: Path) -> None:
    config = render_config(
        tmp_path,
        FRONTEND_DOMAIN="",
        TRAEFIK_MANAGER_PUBLIC_ROUTER_ENABLED="false",
        TRAEFIK_MANAGER_TAILNET_ROUTER_ENABLED="true",
    )

    assert set(config["http"]["routers"]) == {"traefik-manager-tailnet-file"}
    assert "middlewares" not in config["http"]


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        (
            {
                "TRAEFIK_MANAGER_PUBLIC_ROUTER_ENABLED": "false",
                "TRAEFIK_MANAGER_TAILNET_ROUTER_ENABLED": "false",
            },
            "하나 이상 활성화",
        ),
        (
            {"TRAEFIK_MANAGER_PUBLIC_ROUTER_ENABLED": "yes"},
            "true 또는 false",
        ),
        (
            {
                "TRAEFIK_MANAGER_PUBLIC_ROUTER_ENABLED": "false",
                "TRAEFIK_MANAGER_TAILNET_ROUTER_ENABLED": "true",
                "TRAEFIK_MANAGER_TAILNET_ENTRYPOINT": "manager/tailnet",
            },
            "올바른 이름",
        ),
    ],
)
def test_config_rejects_unsafe_router_settings(
    tmp_path: Path,
    overrides: dict[str, str],
    message: str,
) -> None:
    result = run_config(tmp_path, **overrides)

    assert result.returncode != 0
    assert message in result.stderr


def test_blue_green_health_url_prefers_tailnet_frontend_url(tmp_path: Path) -> None:
    (tmp_path / ".env").write_text(
        "FRONTEND_DOMAIN=manager.example.com\n"
        "TAILNET_FRONTEND_URL=https://server-name.example.ts.net:8444\n",
        encoding="utf-8",
    )
    runtime_script = PROJECT_ROOT / "scripts" / "manager-blue-green-runtime.sh"

    result = subprocess.run(
        [
            "bash",
            "-c",
            'REPO_ROOT="$1"; source "$2"; resolve_health_url',
            "test",
            str(tmp_path),
            str(runtime_script),
        ],
        check=True,
        capture_output=True,
        text=True,
    )

    assert result.stdout.strip() == "https://server-name.example.ts.net:8444/api/health"
