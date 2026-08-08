from pathlib import Path

import yaml

PROJECT_ROOT = Path(__file__).resolve().parents[3]


def test_candidate_backends_join_proxy_network_only_after_health_checks():
    compose = yaml.safe_load((PROJECT_ROOT / "docker-compose.yml").read_text(encoding="utf-8"))
    services = compose["services"]
    deploy_script = (PROJECT_ROOT / "scripts/blue-green-deploy.sh").read_text(encoding="utf-8")
    runtime_script = (PROJECT_ROOT / "scripts/manager-blue-green-runtime.sh").read_text(
        encoding="utf-8"
    )
    recovery_script = (PROJECT_ROOT / "scripts/manager-blue-green-recovery.sh").read_text(
        encoding="utf-8"
    )

    assert compose["networks"]["traefik-manager-app"]["internal"] is True
    for slot in ("blue", "green"):
        assert "traefik-manager-app" in services[f"backend-{slot}"]["networks"]
        assert "proxy_net" not in services[f"backend-{slot}"]["networks"]
        assert "traefik-manager-app" in services[f"frontend-{slot}"]["networks"]
    assert 'source "${SCRIPT_DIR}/manager-blue-green-runtime.sh"' in deploy_script
    assert 'source "${SCRIPT_DIR}/manager-blue-green-recovery.sh"' in deploy_script
    assert "docker network connect" in runtime_script
    assert "--alias traefik-manager-backend" in runtime_script
    assert 'history_status="rollback_failed"' in recovery_script
    assert 'notify_rollback_failure "${history_active_slot}"' in recovery_script
    assert 'manager-deployment-bottleneck-alert.sh" "${HISTORY_FILE}"' in recovery_script


def test_manager_self_route_supports_tailnet_cutover() -> None:
    compose = yaml.safe_load((PROJECT_ROOT / "docker-compose.yml").read_text(encoding="utf-8"))
    init_environment = compose["services"]["init-traefik-config"]["environment"]

    assert "TRAEFIK_MANAGER_PUBLIC_ROUTER_ENABLED" in init_environment
    assert "TRAEFIK_MANAGER_TAILNET_ROUTER_ENABLED" in init_environment
    assert init_environment["TRAEFIK_MANAGER_TAILNET_ENTRYPOINT"].endswith(
        ":-manager-tailnet}"
    )


def test_github_visual_smoke_is_manual_and_does_not_require_live_credentials() -> None:
    workflow = (PROJECT_ROOT / ".github/workflows/dashboard-visual-smoke.yml").read_text(
        encoding="utf-8"
    )

    assert "workflow_dispatch:" in workflow
    assert "  schedule:" not in workflow
    assert "smoke-services-browser-session.mjs --self-test" in workflow
    for secret_name in (
        "TM_SMOKE_BASE_URL",
        "TM_SMOKE_COOKIE",
        "TM_SMOKE_USERNAME",
        "TM_SMOKE_PASSWORD",
        "TM_SMOKE_ADMIN_USERNAME",
        "TM_SMOKE_ADMIN_PASSWORD",
    ):
        assert f"secrets.{secret_name}" not in workflow


def test_local_smoke_records_the_active_deployment_revision() -> None:
    script = (PROJECT_ROOT / "scripts/rotate-smoke-viewer-password.sh").read_text(
        encoding="utf-8"
    )

    assert "blue-green-deployment.state" in script
    assert "TM_SMOKE_ROTATION_REVISION" in script
    assert "TM_SMOKE_ROTATION_STARTED_AT" in script
    assert 'smoke_revision="$(resolve_deployed_revision)"' in script
