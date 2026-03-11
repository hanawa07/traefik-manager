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
