from types import SimpleNamespace

from app.infrastructure.cloudflare.client import CloudflareZoneConfig
from app.interfaces.api.v1.routers import settings_cloudflare_router as settings_router


def make_http_request():
    return SimpleNamespace(headers={}, client=SimpleNamespace(host="127.0.0.1"))


def patch_audit_recording(monkeypatch, client_ip: str):
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(settings_router.audit_service, "record", fake_record, raising=False)
    monkeypatch.setattr(settings_router, "get_client_ip", lambda _request: client_ip)
    return recorded


async def fake_get_known_zone_name(_self, zone_config):
    mapping = {
        "zone-1": "hanastay.co.kr",
        "zone-2": "lizstudio.co.kr",
    }
    zone_name = mapping[zone_config.zone_id]
    zone_config.zone_name = zone_name
    return zone_name


class SuccessfulCloudflareConnectionClient:
    async def test_connection(self):
        return {
            "success": True,
            "message": "Cloudflare 연결에 성공했습니다",
            "detail": "example.com 영역에 접근할 수 있습니다",
        }


class ReconcileCloudflareClient:
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

    def __init__(self):
        self.deleted_records = []

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
        self.deleted_records.append((domain, record_id))


class ReconcileServiceRepository:
    saved_services = []

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
        self.saved_services.append((str(service.domain), service.cloudflare_record_id))


class DriftCloudflareClient:
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


class DriftServiceRepository:
    def __init__(self, _db):
        self.services = [
            SimpleNamespace(domain="app.example.com", upstream=SimpleNamespace(host="220.117.211.140")),
            SimpleNamespace(domain="api.example.com", upstream=SimpleNamespace(host="220.117.211.140")),
            SimpleNamespace(domain="missing.example.com", upstream=SimpleNamespace(host="220.117.211.140")),
            SimpleNamespace(domain="outside.other.kr", upstream=SimpleNamespace(host="220.117.211.140")),
        ]

    async def find_all(self):
        return self.services


class FailingDriftCloudflareClient(DriftCloudflareClient):
    async def list_records(self, _zone_config):
        raise settings_router.CloudflareClientError(
            "Cloudflare API 오류 (403): Actor requires permission com.cloudflare.api.account.zone.list"
        )


class FailingDriftServiceRepository:
    def __init__(self, _db):
        self.services = [
            SimpleNamespace(domain="app.example.com", upstream=SimpleNamespace(host="220.117.211.140")),
        ]

    async def find_all(self):
        return self.services
