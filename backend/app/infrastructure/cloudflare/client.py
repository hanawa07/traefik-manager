from ipaddress import ip_address

import httpx

from app.core.config import settings


class CloudflareClientError(Exception):
    """Cloudflare API 처리 실패 예외"""


class CloudflareClient:
    """Cloudflare DNS API 클라이언트 (선택 기능)"""

    def __init__(
        self,
        api_token: str | None = None,
        zone_id: str | None = None,
        record_target: str | None = None,
        proxied: bool | None = None,
    ):
        self.api_token = api_token or settings.CLOUDFLARE_API_TOKEN
        self.zone_id = zone_id or settings.CLOUDFLARE_ZONE_ID
        self.record_target = record_target or settings.CLOUDFLARE_RECORD_TARGET
        self.proxied = proxied if proxied is not None else settings.CLOUDFLARE_PROXIED
        self.timeout = settings.CLOUDFLARE_API_TIMEOUT_SECONDS
        self.base_url = "https://api.cloudflare.com/client/v4"

    @classmethod
    def from_db_settings(cls, db_settings: dict[str, str]) -> "CloudflareClient":
        """DB에서 로드된 설정으로 클라이언트 생성. 없으면 환경변수 fallback."""
        proxied: bool | None = None
        if "cf_proxied" in db_settings:
            proxied = db_settings["cf_proxied"] == "true"
        return cls(
            api_token=db_settings.get("cf_api_token") or None,
            zone_id=db_settings.get("cf_zone_id") or None,
            record_target=db_settings.get("cf_record_target") or None,
            proxied=proxied,
        )

    @property
    def enabled(self) -> bool:
        return bool(self.api_token and self.zone_id)

    def get_status(self) -> dict:
        return {
            "enabled": self.enabled,
            "configured": self.enabled,
            "zone_id": self.zone_id,
            "record_target": self.record_target,
            "proxied": self.proxied,
            "message": (
                "Cloudflare 자동 연동이 활성화되어 있습니다"
                if self.enabled
                else "Cloudflare 설정값이 없어 자동 연동이 비활성화되어 있습니다"
            ),
        }

    async def get_zone_name(self) -> str | None:
        if not self.enabled:
            return None

        async with self._client() as client:
            response = await client.get(f"/zones/{self.zone_id}")
            data = await self._decode_response(response)

        result = data.get("result", {})
        if not isinstance(result, dict):
            return None
        zone_name = result.get("name")
        return zone_name.strip().lower() if isinstance(zone_name, str) and zone_name.strip() else None

    async def test_connection(self) -> dict:
        if not self.enabled:
            return {
                "success": False,
                "message": "Cloudflare 설정이 비활성화되어 있습니다",
                "detail": "API token과 zone id를 먼저 저장하세요",
            }

        try:
            zone_name = await self.get_zone_name()
        except CloudflareClientError as exc:
            return {
                "success": False,
                "message": "Cloudflare 연결 테스트에 실패했습니다",
                "detail": str(exc),
            }

        detail = (
            f"{zone_name} 영역에 접근할 수 있습니다"
            if zone_name
            else "설정된 Zone에 접근할 수 있습니다"
        )
        return {
            "success": True,
            "message": "Cloudflare 연결에 성공했습니다",
            "detail": detail,
        }

    async def upsert_service_record(self, domain: str, fallback_target: str) -> str | None:
        if not self.enabled:
            return None

        content = (self.record_target or fallback_target).strip()
        if not content:
            raise CloudflareClientError("Cloudflare 레코드 대상 값이 없습니다")

        record_type = self._detect_record_type(content)
        payload = {
            "type": record_type,
            "name": domain,
            "content": content,
            "ttl": 1,
            "proxied": self.proxied,
            "comment": "managed-by-traefik-manager",
        }

        async with self._client() as client:
            existing = await self._find_records(client, domain=domain, record_type=record_type)
            if existing:
                record_id = existing[0]["id"]
                response = await client.put(
                    f"/zones/{self.zone_id}/dns_records/{record_id}",
                    json=payload,
                )
            else:
                response = await client.post(
                    f"/zones/{self.zone_id}/dns_records",
                    json=payload,
                )

            data = await self._decode_response(response)
            return data["result"]["id"]

    async def delete_service_record(self, domain: str, record_id: str | None) -> None:
        if not self.enabled:
            return

        async with self._client() as client:
            target_ids: list[str] = []
            if record_id:
                target_ids.append(record_id)
            else:
                records = await self._find_records(client, domain=domain)
                target_ids.extend(record["id"] for record in records)

            for current_record_id in target_ids:
                response = await client.delete(f"/zones/{self.zone_id}/dns_records/{current_record_id}")
                if response.status_code == 404:
                    continue
                await self._decode_response(response)

    async def _find_records(
        self,
        client: httpx.AsyncClient,
        domain: str,
        record_type: str | None = None,
    ) -> list[dict]:
        params = {"name": domain}
        if record_type:
            params["type"] = record_type

        response = await client.get(f"/zones/{self.zone_id}/dns_records", params=params)
        data = await self._decode_response(response)
        results = data.get("result", [])
        if not isinstance(results, list):
            return []
        return [item for item in results if isinstance(item, dict)]

    def _client(self) -> httpx.AsyncClient:
        headers = {
            "Authorization": f"Bearer {self.api_token}",
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
