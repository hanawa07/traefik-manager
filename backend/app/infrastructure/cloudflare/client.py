import httpx

from app.core.config import settings
from app.infrastructure.cloudflare.client_config import (
    build_cloudflare_status,
    build_zone_configs,
    build_zone_configs_from_db_settings,
)
from app.infrastructure.cloudflare.dns_records import (
    delete_service_dns_record,
    find_dns_records,
    list_dns_records,
    list_managed_dns_records,
    upsert_service_dns_record,
)
from app.infrastructure.cloudflare.errors import CloudflareClientError
from app.infrastructure.cloudflare.http_client import create_cloudflare_http_client
from app.infrastructure.cloudflare.record_payloads import (
    build_service_record_payload,
    detect_record_type,
)
from app.infrastructure.cloudflare.responses import decode_cloudflare_response
from app.infrastructure.cloudflare.zone_config import (
    CF_ZONE_CONFIGS_KEY,
    CloudflareZoneConfig,
    parse_zone_configs,
    serialize_zone_configs,
)
from app.infrastructure.cloudflare.zone_runtime import (
    ensure_zone_names,
    fetch_zone_name,
    find_matching_zone,
    run_zone_connection_test,
)


class CloudflareClient:
    """Cloudflare DNS API 클라이언트.

    기본 구조는 여러 Cloudflare zone을 동시에 관리한다.
    기존 단일 zone 설정(`cf_api_token`, `cf_zone_id`...)은 읽기 전용 호환 경로로 유지한다.
    """

    def __init__(
        self,
        zone_configs: list[CloudflareZoneConfig] | None = None,
        api_token: str | None = None,
        zone_id: str | None = None,
        record_target: str | None = None,
        proxied: bool | None = None,
    ):
        self.timeout = settings.CLOUDFLARE_API_TIMEOUT_SECONDS
        self.base_url = "https://api.cloudflare.com/client/v4"
        self.zone_configs = build_zone_configs(
            zone_configs=zone_configs,
            api_token=api_token,
            zone_id=zone_id,
            record_target=record_target,
            proxied=proxied,
        )

    @classmethod
    def from_db_settings(cls, db_settings: dict[str, str]) -> "CloudflareClient":
        return cls(zone_configs=build_zone_configs_from_db_settings(db_settings))

    parse_zone_configs = staticmethod(parse_zone_configs)
    serialize_zone_configs = staticmethod(serialize_zone_configs)
    _decode_response = staticmethod(decode_cloudflare_response)
    _detect_record_type = staticmethod(detect_record_type)

    @property
    def enabled(self) -> bool:
        return bool(self.zone_configs)

    def get_status(self) -> dict:
        return build_cloudflare_status(self.zone_configs)

    async def get_zone_name(self, zone_config: CloudflareZoneConfig | None = None) -> str | None:
        config = zone_config or (self.zone_configs[0] if self.zone_configs else None)
        return await fetch_zone_name(
            client_factory=self._client,
            decode_response=self._decode_response,
            zone_config=config,
        )

    async def ensure_zone_names(self) -> None:
        await ensure_zone_names(
            zone_configs=self.zone_configs,
            client_factory=self._client,
            decode_response=self._decode_response,
        )

    async def test_connection(self) -> dict:
        return await run_zone_connection_test(
            zone_configs=self.zone_configs,
            client_factory=self._client,
            decode_response=self._decode_response,
        )

    async def get_matching_zone(self, domain: str) -> CloudflareZoneConfig | None:
        return await find_matching_zone(
            zone_configs=self.zone_configs,
            domain=domain,
            client_factory=self._client,
            decode_response=self._decode_response,
        )

    async def upsert_service_record(self, domain: str, fallback_target: str) -> str | None:
        zone_config = await self.get_matching_zone(domain)
        if zone_config is None:
            return None

        payload = self.build_service_record_payload(
            domain=domain,
            fallback_target=fallback_target,
            zone_config=zone_config,
        )
        return await upsert_service_dns_record(
            client_factory=self._client,
            decode_response=self._decode_response,
            zone_config=zone_config,
            domain=domain,
            payload=payload,
        )

    def build_service_record_payload(
        self,
        domain: str,
        fallback_target: str,
        zone_config: CloudflareZoneConfig | None = None,
    ) -> dict[str, object]:
        return build_service_record_payload(domain, fallback_target, zone_config)

    async def delete_service_record(self, domain: str, record_id: str | None) -> None:
        zone_config = await self.get_matching_zone(domain)
        if zone_config is None:
            return

        await delete_service_dns_record(
            client_factory=self._client,
            decode_response=self._decode_response,
            zone_config=zone_config,
            domain=domain,
            record_id=record_id,
        )

    async def list_managed_records(self, zone_config: CloudflareZoneConfig) -> list[dict]:
        return await list_managed_dns_records(
            client_factory=self._client,
            decode_response=self._decode_response,
            zone_config=zone_config,
        )

    async def list_records(self, zone_config: CloudflareZoneConfig) -> list[dict]:
        return await list_dns_records(
            client_factory=self._client,
            decode_response=self._decode_response,
            zone_config=zone_config,
        )

    async def _find_records(
        self,
        client: httpx.AsyncClient,
        zone_id: str,
        domain: str,
        record_type: str | None = None,
    ) -> list[dict]:
        return await find_dns_records(
            client,
            decode_response=self._decode_response,
            zone_id=zone_id,
            domain=domain,
            record_type=record_type,
        )

    def _client(self, zone_config: CloudflareZoneConfig) -> httpx.AsyncClient:
        return create_cloudflare_http_client(
            base_url=self.base_url,
            timeout=self.timeout,
            zone_config=zone_config,
        )
