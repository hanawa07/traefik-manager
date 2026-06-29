import httpx

from app.core.config import settings
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
        if zone_configs is not None:
            self.zone_configs = [config for config in zone_configs if config.api_token and config.zone_id]
        else:
            effective_api_token = api_token or settings.CLOUDFLARE_API_TOKEN
            effective_zone_id = zone_id or settings.CLOUDFLARE_ZONE_ID
            effective_record_target = record_target or settings.CLOUDFLARE_RECORD_TARGET
            effective_proxied = proxied if proxied is not None else settings.CLOUDFLARE_PROXIED
            self.zone_configs = (
                [
                    CloudflareZoneConfig(
                        api_token=effective_api_token,
                        zone_id=effective_zone_id,
                        record_target=effective_record_target,
                        proxied=effective_proxied,
                    )
                ]
                if effective_api_token and effective_zone_id
                else []
            )

    @classmethod
    def from_db_settings(cls, db_settings: dict[str, str]) -> "CloudflareClient":
        zone_configs = cls.parse_zone_configs(db_settings.get(CF_ZONE_CONFIGS_KEY))
        if zone_configs:
            return cls(zone_configs=zone_configs)

        proxied: bool | None = None
        if "cf_proxied" in db_settings:
            proxied = db_settings["cf_proxied"] == "true"
        return cls(
            api_token=db_settings.get("cf_api_token") or None,
            zone_id=db_settings.get("cf_zone_id") or None,
            record_target=db_settings.get("cf_record_target") or None,
            proxied=proxied,
        )

    parse_zone_configs = staticmethod(parse_zone_configs)
    serialize_zone_configs = staticmethod(serialize_zone_configs)
    _decode_response = staticmethod(decode_cloudflare_response)
    _detect_record_type = staticmethod(detect_record_type)

    @property
    def enabled(self) -> bool:
        return bool(self.zone_configs)

    def get_status(self) -> dict:
        zones = [
            {
                "zone_id": config.zone_id,
                "zone_name": config.zone_name,
                "record_target": config.record_target,
                "proxied": config.proxied,
            }
            for config in sorted(self.zone_configs, key=lambda item: item.zone_name or item.zone_id)
        ]
        return {
            "enabled": self.enabled,
            "configured": self.enabled,
            "zone_count": len(zones),
            "zones": zones,
            "message": (
                f"Cloudflare 자동 연동이 {len(zones)}개 영역에 대해 활성화되어 있습니다"
                if self.enabled
                else "Cloudflare 설정값이 없어 자동 연동이 비활성화되어 있습니다"
            ),
        }

    async def get_zone_name(self, zone_config: CloudflareZoneConfig | None = None) -> str | None:
        config = zone_config or (self.zone_configs[0] if self.zone_configs else None)
        if not config:
            return None

        async with self._client(config) as client:
            response = await client.get(f"/zones/{config.zone_id}")
            data = await self._decode_response(response)

        result = data.get("result", {})
        if not isinstance(result, dict):
            return None
        zone_name = result.get("name")
        normalized_zone_name = (
            zone_name.strip().lower() if isinstance(zone_name, str) and zone_name.strip() else None
        )
        config.zone_name = normalized_zone_name
        return normalized_zone_name

    async def ensure_zone_names(self) -> None:
        for config in self.zone_configs:
            if not config.zone_name:
                await self.get_zone_name(config)

    async def test_connection(self) -> dict:
        if not self.enabled:
            return {
                "success": False,
                "message": "Cloudflare 설정이 비활성화되어 있습니다",
                "detail": "API token과 zone id를 먼저 저장하세요",
            }

        resolved_zone_names: list[str] = []
        failed_details: list[str] = []
        for config in self.zone_configs:
            try:
                zone_name = await self.get_zone_name(config)
            except CloudflareClientError as exc:
                failed_details.append(f"{config.zone_id}: {exc}")
                continue
            resolved_zone_names.append(zone_name or config.zone_id)

        if failed_details:
            return {
                "success": False,
                "message": "Cloudflare 연결 테스트에 실패했습니다",
                "detail": "; ".join(failed_details),
            }

        return {
            "success": True,
            "message": "Cloudflare 연결에 성공했습니다",
            "detail": ", ".join(resolved_zone_names) if resolved_zone_names else "설정된 영역에 접근할 수 있습니다",
        }

    async def get_matching_zone(self, domain: str) -> CloudflareZoneConfig | None:
        if not self.enabled:
            return None
        await self.ensure_zone_names()
        matching_configs = [config for config in self.zone_configs if config.matches_domain(domain)]
        if not matching_configs:
            return None
        return max(matching_configs, key=lambda item: len(item.zone_name or ""))

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
