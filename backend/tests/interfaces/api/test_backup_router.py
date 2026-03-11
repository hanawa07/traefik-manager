import pytest

from app.interfaces.api.v1.routers import backup as backup_router
from app.interfaces.api.v1.schemas.backup_schemas import BackupImportRequest


class StubBackupUseCases:
    async def validate_payload(self, payload: dict):
        assert payload == {
            "services": [
                {
                    "name": "home",
                    "domain": "home.example.com",
                    "upstream_host": "homepage",
                    "upstream_port": 3000,
                    "upstream_scheme": "http",
                    "skip_tls_verify": False,
                    "tls_enabled": True,
                    "https_redirect_enabled": True,
                    "auth_enabled": False,
                    "allowed_ips": [],
                    "blocked_paths": [],
                    "rate_limit_average": None,
                    "rate_limit_burst": None,
                    "custom_headers": {},
                    "frame_policy": "deny",
                    "healthcheck_enabled": True,
                    "healthcheck_path": "/",
                    "healthcheck_timeout_ms": 3000,
                    "healthcheck_expected_statuses": [],
                    "basic_auth_users": [],
                    "middleware_template_ids": [],
                    "authentik_provider_id": None,
                    "authentik_app_slug": None,
                    "authentik_group_id": None,
                    "authentik_group_name": None,
                    "authentik_policy_id": None,
                    "authentik_policy_binding_id": None,
                    "cloudflare_record_id": None,
                }
            ],
            "redirect_hosts": [],
        }
        return {
            "valid": True,
            "service_count": 1,
            "redirect_count": 0,
            "warning_count": 0,
            "warnings": [],
        }

    async def preview_import(self, mode: str, payload: dict):
        assert mode == "merge"
        assert payload["services"][0]["domain"] == "home.example.com"
        return {
            "mode": mode,
            "service_count": 1,
            "redirect_count": 0,
            "warning_count": 0,
            "warnings": [],
            "services": {
                "creates": [],
                "updates": [{"domain": "home.example.com", "name": "home"}],
                "deletes": [],
            },
            "redirect_hosts": {
                "creates": [],
                "updates": [],
                "deletes": [],
            },
        }


@pytest.mark.asyncio
async def test_validate_backup_returns_summary():
    response = await backup_router.validate_backup(
        request=BackupImportRequest(
            mode="merge",
            data={
                "services": [
                    {
                        "name": "home",
                        "domain": "home.example.com",
                        "upstream_host": "homepage",
                        "upstream_port": 3000,
                        "auth_enabled": False,
                    }
                ],
                "redirect_hosts": [],
            },
        ),
        use_cases=StubBackupUseCases(),
        _={"role": "admin"},
    )

    assert response.valid is True
    assert response.service_count == 1
    assert response.redirect_count == 0
    assert response.warning_count == 0


@pytest.mark.asyncio
async def test_preview_backup_returns_diff_summary():
    response = await backup_router.preview_backup(
        request=BackupImportRequest(
            mode="merge",
            data={
                "services": [
                    {
                        "name": "home",
                        "domain": "home.example.com",
                        "upstream_host": "homepage",
                        "upstream_port": 3000,
                        "auth_enabled": False,
                    }
                ],
                "redirect_hosts": [],
            },
        ),
        use_cases=StubBackupUseCases(),
        _={"role": "admin"},
    )

    assert response.mode == "merge"
    assert response.service_count == 1
    assert response.services.updates[0].domain == "home.example.com"
    assert response.services.updates[0].name == "home"
    assert response.services.creates == []
