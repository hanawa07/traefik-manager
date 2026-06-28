from types import SimpleNamespace

import pytest

from app.infrastructure.cloudflare.client import CloudflareZoneConfig
from app.interfaces.api.v1.routers import settings as settings_router
from app.interfaces.api.v1.schemas.settings_schemas import CloudflareSettingsUpdateRequest
from tests.interfaces.api.settings_router_fakes import StubSettingsRepository


@pytest.mark.asyncio
async def test_update_cloudflare_settings_persists_multi_zone_and_records_audit(monkeypatch):
    StubSettingsRepository.store = {
        "cf_api_token": "legacy-token",
        "cf_zone_id": "legacy-zone",
        "cf_record_target": "220.117.211.140",
        "cf_proxied": "true",
    }
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(settings_router, "get_client_ip", lambda _request: "203.0.113.21")
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    async def fake_get_zone_name(self, zone_config):
        mapping = {
            "zone-1": "hanastay.co.kr",
            "zone-2": "lizstudio.co.kr",
        }
        zone_name = mapping[zone_config.zone_id]
        zone_config.zone_name = zone_name
        return zone_name

    monkeypatch.setattr(settings_router.audit_service, "record", fake_record, raising=False)
    monkeypatch.setattr(settings_router.CloudflareClient, "get_zone_name", fake_get_zone_name)

    response = await settings_router.update_cloudflare_settings(
        request=CloudflareSettingsUpdateRequest(
            zones=[
                {
                    "api_token": "token-1",
                    "zone_id": "zone-1",
                    "record_target": "220.117.211.140",
                    "proxied": True,
                },
                {
                    "api_token": "token-2",
                    "zone_id": "zone-2",
                    "record_target": "220.117.211.140",
                    "proxied": False,
                },
            ]
        ),
        db=object(),
        _={"role": "admin", "username": "admin"},
        http_request=SimpleNamespace(headers={}, client=SimpleNamespace(host="127.0.0.1")),
    )

    assert response["enabled"] is True
    assert response["zone_count"] == 2
    assert "cf_api_token" not in StubSettingsRepository.store
    assert "cf_zone_id" not in StubSettingsRepository.store
    assert "cf_record_target" not in StubSettingsRepository.store
    assert "cf_proxied" not in StubSettingsRepository.store
    assert settings_router.CF_ZONE_CONFIGS_KEY in StubSettingsRepository.store
    assert recorded[0]["detail"]["event"] == "settings_update_cloudflare"
    assert recorded[0]["detail"]["after"]["zone_count"] == 2
    assert recorded[0]["detail"]["after"]["zones"][0]["zone_name"] == "hanastay.co.kr"
    assert recorded[0]["detail"]["after"]["zones"][1]["zone_name"] == "lizstudio.co.kr"
    assert recorded[0]["detail"]["client_ip"] == "203.0.113.21"


@pytest.mark.asyncio
async def test_test_cloudflare_connection_returns_success(monkeypatch):
    recorded = []

    class StubCloudflareClient:
        async def test_connection(self):
            return {
                "success": True,
                "message": "Cloudflare 연결에 성공했습니다",
                "detail": "example.com 영역에 접근할 수 있습니다",
            }

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(settings_router.audit_service, "record", fake_record, raising=False)
    monkeypatch.setattr(settings_router, "get_client_ip", lambda _request: "203.0.113.10")

    response = await settings_router.test_cloudflare_connection(
        request=SimpleNamespace(headers={}, client=SimpleNamespace(host="127.0.0.1")),
        db=object(),
        cloudflare_client=StubCloudflareClient(),
        _={"role": "admin", "username": "admin"},
    )

    assert response.success is True
    assert response.message == "Cloudflare 연결에 성공했습니다"
    assert response.detail == "example.com 영역에 접근할 수 있습니다"
    assert recorded[0]["resource_type"] == "settings"
    assert recorded[0]["resource_name"] == "Cloudflare 연결 테스트"
    assert recorded[0]["detail"]["event"] == "settings_test_cloudflare"
    assert recorded[0]["detail"]["success"] is True
    assert recorded[0]["detail"]["client_ip"] == "203.0.113.10"


@pytest.mark.asyncio
async def test_reconcile_cloudflare_dns_syncs_zone_services_and_records_audit(monkeypatch):
    recorded = []
    saved_services = []
    deleted_records = []

    class StubCloudflareClient:
        enabled = True
        zone_configs = [
            CloudflareZoneConfig(
                api_token="token-example",
                zone_id="zone-example",
                zone_name="example.com",
                record_target="220.117.211.140",
                proxied=True,
            )
        ]

        async def ensure_zone_names(self):
            return None

        async def get_matching_zone(self, domain: str):
            zone = self.zone_configs[0]
            return zone if zone.matches_domain(domain) else None

        async def upsert_service_record(self, domain: str, fallback_target: str):
            return f"cf-{domain}"

        async def list_managed_records(self, _zone_config):
            return [
                {"id": "record-1", "name": "app.example.com", "comment": "managed-by-traefik-manager"},
                {"id": "record-2", "name": "old.example.com", "comment": "managed-by-traefik-manager"},
            ]

        async def delete_service_record(self, domain: str, record_id: str | None):
            deleted_records.append((domain, record_id))

    class StubServiceRepository:
        def __init__(self, _db):
            self.services = [
                SimpleNamespace(
                    domain="app.example.com",
                    upstream=SimpleNamespace(host="220.117.211.140"),
                    cloudflare_record_id=None,
                ),
                SimpleNamespace(
                    domain="api.example.com",
                    upstream=SimpleNamespace(host="220.117.211.140"),
                    cloudflare_record_id="old-record",
                ),
                SimpleNamespace(
                    domain="outside.other.kr",
                    upstream=SimpleNamespace(host="220.117.211.140"),
                    cloudflare_record_id=None,
                ),
            ]

        async def find_all(self):
            return self.services

        async def save(self, service):
            saved_services.append((str(service.domain), service.cloudflare_record_id))

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(settings_router, "SQLiteServiceRepository", StubServiceRepository)
    monkeypatch.setattr(settings_router.audit_service, "record", fake_record, raising=False)
    monkeypatch.setattr(settings_router, "get_client_ip", lambda _request: "203.0.113.20")

    response = await settings_router.reconcile_cloudflare_dns(
        request=SimpleNamespace(headers={}, client=SimpleNamespace(host="127.0.0.1")),
        db=object(),
        cloudflare_client=StubCloudflareClient(),
        _={"role": "admin", "username": "admin"},
    )

    assert response.success is True
    assert response.message == "Cloudflare DNS 재동기화가 완료되었습니다"
    assert response.detail == "Cloudflare 관리 대상 서비스 2개를 동기화했습니다, 고아 레코드 1개를 정리했습니다, 비Cloudflare 도메인 1개는 제외했습니다"
    assert saved_services == [
        ("app.example.com", "cf-app.example.com"),
        ("api.example.com", "cf-api.example.com"),
    ]
    assert deleted_records == [("old.example.com", "record-2")]
    assert recorded[0]["resource_name"] == "Cloudflare DNS 재동기화"
    assert recorded[0]["detail"]["event"] == "settings_test_cloudflare_reconcile"
    assert recorded[0]["detail"]["success"] is True
    assert recorded[0]["detail"]["synced_services"] == 2
    assert recorded[0]["detail"]["cleaned_records"] == 1
    assert recorded[0]["detail"]["skipped_services"] == 1
    assert recorded[0]["detail"]["client_ip"] == "203.0.113.20"


@pytest.mark.asyncio
async def test_diagnose_cloudflare_dns_drift_returns_missing_mismatch_and_orphan(monkeypatch):
    recorded = []

    class StubCloudflareClient:
        enabled = True
        zone_configs = [
            CloudflareZoneConfig(
                api_token="token-example",
                zone_id="zone-example",
                zone_name="example.com",
                record_target="220.117.211.140",
                proxied=True,
            )
        ]

        async def ensure_zone_names(self):
            return None

        async def get_matching_zone(self, domain: str):
            zone = self.zone_configs[0]
            return zone if zone.matches_domain(domain) else None

        def build_service_record_payload(self, domain: str, fallback_target: str, zone_config=None):
            return {
                "type": "A",
                "name": domain,
                "content": "220.117.211.140",
                "ttl": 1,
                "proxied": True,
                "comment": "managed-by-traefik-manager",
            }

        async def list_records(self, _zone_config):
            return [
                {
                    "id": "record-app",
                    "name": "app.example.com",
                    "type": "A",
                    "content": "220.117.211.140",
                    "proxied": True,
                    "comment": "managed-by-traefik-manager",
                },
                {
                    "id": "record-api",
                    "name": "api.example.com",
                    "type": "A",
                    "content": "203.0.113.55",
                    "proxied": True,
                    "comment": "managed-by-traefik-manager",
                },
                {
                    "id": "record-old",
                    "name": "old.example.com",
                    "type": "A",
                    "content": "220.117.211.140",
                    "proxied": False,
                    "comment": "managed-by-traefik-manager",
                },
            ]

    class StubServiceRepository:
        def __init__(self, _db):
            self.services = [
                SimpleNamespace(domain="app.example.com", upstream=SimpleNamespace(host="220.117.211.140")),
                SimpleNamespace(domain="api.example.com", upstream=SimpleNamespace(host="220.117.211.140")),
                SimpleNamespace(domain="missing.example.com", upstream=SimpleNamespace(host="220.117.211.140")),
                SimpleNamespace(domain="outside.other.kr", upstream=SimpleNamespace(host="220.117.211.140")),
            ]

        async def find_all(self):
            return self.services

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(settings_router, "SQLiteServiceRepository", StubServiceRepository)
    monkeypatch.setattr(settings_router.audit_service, "record", fake_record, raising=False)
    monkeypatch.setattr(settings_router, "get_client_ip", lambda _request: "203.0.113.21")

    response = await settings_router.diagnose_cloudflare_dns_drift(
        request=SimpleNamespace(headers={}, client=SimpleNamespace(host="127.0.0.1")),
        db=object(),
        cloudflare_client=StubCloudflareClient(),
        _={"role": "admin", "username": "admin"},
    )

    assert response.success is False
    assert response.zone_count == 1
    assert response.eligible_services == 3
    assert response.skipped_services == 1
    assert response.healthy_services == 1
    assert response.detail == "정상 1개, 비Cloudflare 도메인 1개 제외"
    assert response.zones[0].zone_name == "example.com"
    assert [item.domain for item in response.missing_records] == ["missing.example.com"]
    assert [item.domain for item in response.mismatched_records] == ["api.example.com"]
    assert [item.domain for item in response.orphan_records] == ["old.example.com"]
    assert [item.domain for item in response.excluded_services] == ["outside.other.kr"]
    assert recorded[0]["resource_name"] == "Cloudflare DNS 드리프트 진단"
    assert recorded[0]["detail"]["event"] == "settings_test_cloudflare_drift"
    assert recorded[0]["detail"]["missing_records"] == 1
    assert recorded[0]["detail"]["mismatched_records"] == 1
    assert recorded[0]["detail"]["orphan_records"] == 1
    assert recorded[0]["detail"]["client_ip"] == "203.0.113.21"


@pytest.mark.asyncio
async def test_diagnose_cloudflare_dns_drift_returns_failure_response_when_cloudflare_errors(monkeypatch):
    recorded = []

    class StubCloudflareClient:
        enabled = True
        zone_configs = [
            CloudflareZoneConfig(
                api_token="token-example",
                zone_id="zone-example",
                zone_name="example.com",
                record_target="220.117.211.140",
                proxied=True,
            )
        ]

        async def ensure_zone_names(self):
            return None

        async def get_matching_zone(self, domain: str):
            zone = self.zone_configs[0]
            return zone if zone.matches_domain(domain) else None

        async def list_records(self, _zone_config):
            raise settings_router.CloudflareClientError("Cloudflare API 오류 (403): Actor requires permission com.cloudflare.api.account.zone.list")

    class StubServiceRepository:
        def __init__(self, _db):
            self.services = [
                SimpleNamespace(domain="app.example.com", upstream=SimpleNamespace(host="220.117.211.140")),
            ]

        async def find_all(self):
            return self.services

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(settings_router, "SQLiteServiceRepository", StubServiceRepository)
    monkeypatch.setattr(settings_router.audit_service, "record", fake_record, raising=False)
    monkeypatch.setattr(settings_router, "get_client_ip", lambda _request: "203.0.113.22")

    response = await settings_router.diagnose_cloudflare_dns_drift(
        request=SimpleNamespace(headers={}, client=SimpleNamespace(host="127.0.0.1")),
        db=object(),
        cloudflare_client=StubCloudflareClient(),
        _={"role": "admin", "username": "admin"},
    )

    assert response.success is False
    assert response.message == "Cloudflare DNS 드리프트 진단에 실패했습니다"
    assert "403" in (response.detail or "")
    assert response.zone_count == 1
    assert response.total_services == 1
    assert response.eligible_services == 1
    assert recorded[0]["detail"]["event"] == "settings_test_cloudflare_drift"
    assert recorded[0]["detail"]["success"] is False
    assert "403" in recorded[0]["detail"]["detail"]
    assert recorded[0]["detail"]["client_ip"] == "203.0.113.22"


def test_cloudflare_settings_update_request_normalizes_multiple_zones_and_skips_empty_rows():
    request = CloudflareSettingsUpdateRequest(
        zones=[
            {
                "api_token": " token-a ",
                "zone_id": " zone-a ",
                "record_target": " 220.117.211.140 ",
                "proxied": True,
            },
            {
                "api_token": "",
                "zone_id": "",
                "record_target": "",
                "proxied": False,
            },
            {
                "api_token": "token-b",
                "zone_id": "zone-b",
                "record_target": "",
                "proxied": False,
            },
        ]
    )

    assert len(request.zones) == 2
    assert request.zones[0].api_token == "token-a"
    assert request.zones[0].zone_id == "zone-a"
    assert request.zones[0].record_target == "220.117.211.140"
    assert request.zones[1].zone_id == "zone-b"
