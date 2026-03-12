from dataclasses import dataclass
from ipaddress import ip_address
import json

import httpx

from app.core.config import settings

CF_ZONE_CONFIGS_KEY = "cf_zone_configs"


class CloudflareClientError(Exception):
    """Cloudflare API 처리 실패 예외"""


@dataclass
class CloudflareZoneConfig:
    api_token: str
    zone_id: str
    zone_name: str | None = None
    record_target: str | None = None
    proxied: bool = False

    def matches_domain(self, domain: str) -> bool:
        if not self.zone_name:
            return False
        return domain == self.zone_name or domain.endswith(f".{self.zone_name}")


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

    @staticmethod
    def parse_zone_configs(raw: str | None) -> list[CloudflareZoneConfig]:
        if not raw:
            return []

        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            return []

        if not isinstance(payload, list):
            return []

        zone_configs: list[CloudflareZoneConfig] = []
        for item in payload:
            if not isinstance(item, dict):
                continue
            api_token = item.get("api_token")
            zone_id = item.get("zone_id")
            zone_name = item.get("zone_name")
            if not isinstance(api_token, str) or not api_token.strip():
                continue
            if not isinstance(zone_id, str) or not zone_id.strip():
                continue
            zone_configs.append(
                CloudflareZoneConfig(
                    api_token=api_token.strip(),
                    zone_id=zone_id.strip(),
                    zone_name=zone_name.strip().lower() if isinstance(zone_name, str) and zone_name.strip() else None,
                    record_target=item.get("record_target").strip()
                    if isinstance(item.get("record_target"), str) and item.get("record_target").strip()
                    else None,
                    proxied=bool(item.get("proxied", False)),
                )
            )
        return zone_configs

    @staticmethod
    def serialize_zone_configs(zone_configs: list[CloudflareZoneConfig]) -> str:
        return json.dumps(
            [
                {
                    "api_token": config.api_token,
                    "zone_id": config.zone_id,
                    "zone_name": config.zone_name,
                    "record_target": config.record_target,
                    "proxied": config.proxied,
                }
                for config in zone_configs
            ]
        )

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

        async with self._client(zone_config) as client:
            existing = await self._find_records(
                client,
                zone_id=zone_config.zone_id,
                domain=domain,
                record_type=payload["type"],
            )
            if existing:
                record_id = existing[0]["id"]
                response = await client.put(
                    f"/zones/{zone_config.zone_id}/dns_records/{record_id}",
                    json=payload,
                )
            else:
                response = await client.post(
                    f"/zones/{zone_config.zone_id}/dns_records",
                    json=payload,
                )

            data = await self._decode_response(response)
            return data["result"]["id"]

    def build_service_record_payload(
        self,
        domain: str,
        fallback_target: str,
        zone_config: CloudflareZoneConfig | None = None,
    ) -> dict[str, object]:
        content = ((zone_config.record_target if zone_config else None) or fallback_target).strip()
        if not content:
            raise CloudflareClientError("Cloudflare 레코드 대상 값이 없습니다")

        record_type = self._detect_record_type(content)
        return {
            "type": record_type,
            "name": domain,
            "content": content,
            "ttl": 1,
            "proxied": zone_config.proxied if zone_config else False,
            "comment": "managed-by-traefik-manager",
        }

    async def delete_service_record(self, domain: str, record_id: str | None) -> None:
        zone_config = await self.get_matching_zone(domain)
        if zone_config is None:
            return

        async with self._client(zone_config) as client:
            target_ids: list[str] = []
            if record_id:
                target_ids.append(record_id)
            else:
                records = await self._find_records(
                    client,
                    zone_id=zone_config.zone_id,
                    domain=domain,
                )
                target_ids.extend(record["id"] for record in records)

            for current_record_id in target_ids:
                response = await client.delete(
                    f"/zones/{zone_config.zone_id}/dns_records/{current_record_id}"
                )
                if response.status_code == 404:
                    continue
                await self._decode_response(response)

    async def list_managed_records(self, zone_config: CloudflareZoneConfig) -> list[dict]:
        all_records = await self.list_records(zone_config)
        return [
            item
            for item in all_records
            if isinstance(item, dict) and item.get("comment") == "managed-by-traefik-manager"
        ]

    async def list_records(self, zone_config: CloudflareZoneConfig) -> list[dict]:
        managed_records: list[dict] = []
        page = 1

        async with self._client(zone_config) as client:
            while True:
                response = await client.get(
                    f"/zones/{zone_config.zone_id}/dns_records",
                    params={"per_page": 100, "page": page},
                )
                data = await self._decode_response(response)
                results = data.get("result", [])
                if isinstance(results, list):
                    managed_records.extend(item for item in results if isinstance(item, dict))

                result_info = data.get("result_info", {})
                total_pages = result_info.get("total_pages") if isinstance(result_info, dict) else None
                if not isinstance(total_pages, int) or page >= total_pages:
                    break
                page += 1

        return managed_records

    async def _find_records(
        self,
        client: httpx.AsyncClient,
        zone_id: str,
        domain: str,
        record_type: str | None = None,
    ) -> list[dict]:
        params = {"name": domain}
        if record_type:
            params["type"] = record_type

        response = await client.get(f"/zones/{zone_id}/dns_records", params=params)
        data = await self._decode_response(response)
        results = data.get("result", [])
        if not isinstance(results, list):
            return []
        return [item for item in results if isinstance(item, dict)]

    def _client(self, zone_config: CloudflareZoneConfig) -> httpx.AsyncClient:
        headers = {
            "Authorization": f"Bearer {zone_config.api_token}",
            "Content-Type": "application/json",
        }
        return httpx.AsyncClient(
            base_url=self.base_url,
            headers=headers,
            timeout=self.timeout,
        )

    async def _decode_response(self, response: httpx.Response) -> dict:
        try:
            response.raise_for_status()
            payload = response.json()
        except httpx.HTTPStatusError as exc:
            message = None
            try:
                payload = response.json()
            except ValueError:
                payload = None
            if isinstance(payload, dict):
                errors = payload.get("errors", [])
                if errors and isinstance(errors[0], dict):
                    candidate = errors[0].get("message")
                    if isinstance(candidate, str) and candidate.strip():
                        message = candidate.strip()
            detail = message or f"HTTP {response.status_code}"
            raise CloudflareClientError(f"Cloudflare API 오류 ({response.status_code}): {detail}") from exc
        except (httpx.HTTPError, ValueError) as exc:
            raise CloudflareClientError("Cloudflare API 응답 처리에 실패했습니다") from exc

        if not payload.get("success", False):
            errors = payload.get("errors", [])
            message = errors[0].get("message") if errors and isinstance(errors[0], dict) else "알 수 없는 오류"
            raise CloudflareClientError(f"Cloudflare API 오류: {message}")

        return payload

    def _detect_record_type(self, content: str) -> str:
        try:
            parsed = ip_address(content)
            return "A" if parsed.version == 4 else "AAAA"
        except ValueError:
            return "CNAME"
