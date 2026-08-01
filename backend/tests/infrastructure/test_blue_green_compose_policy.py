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
