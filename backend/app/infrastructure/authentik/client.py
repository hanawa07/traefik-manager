import httpx
from app.core.config import settings


class AuthentikClient:
    """Authentik API 클라이언트"""

    def __init__(self):
        self.base_url = f"{settings.AUTHENTIK_URL}/api/v3"
        self.headers = {
            "Authorization": f"Bearer {settings.AUTHENTIK_TOKEN}",
            "Content-Type": "application/json",
        }

    async def create_proxy_provider(self, name: str, domain: str) -> dict:
        """Forward Auth 프로바이더 생성"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/providers/proxy/",
                headers=self.headers,
                json={
                    "name": name,
                    "external_host": f"https://{domain}",
                    "mode": "forward_single",
                    "authorization_flow": await self._get_default_auth_flow(client),
                },
                timeout=10.0,
            )
            response.raise_for_status()
            return response.json()

    async def create_application(self, name: str, slug: str, provider_pk: int) -> dict:
        """Authentik 애플리케이션 생성"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/core/applications/",
                headers=self.headers,
                json={
                    "name": name,
                    "slug": slug,
                    "provider": provider_pk,
                },
                timeout=10.0,
            )
            response.raise_for_status()
            return response.json()

    async def delete_application(self, slug: str) -> None:
        async with httpx.AsyncClient() as client:
            await client.delete(
                f"{self.base_url}/core/applications/{slug}/",
                headers=self.headers,
                timeout=10.0,
            )

    async def delete_provider(self, provider_id: int) -> None:
        async with httpx.AsyncClient() as client:
            await client.delete(
                f"{self.base_url}/providers/proxy/{provider_id}/",
                headers=self.headers,
                timeout=10.0,
            )

    async def _get_default_auth_flow(self, client: httpx.AsyncClient) -> str:
        response = await client.get(
            f"{self.base_url}/flows/instances/?designation=authorization",
            headers=self.headers,
            timeout=10.0,
        )
        response.raise_for_status()
        flows = response.json()["results"]
        if not flows:
            raise ValueError("Authentik에 인증 플로우가 없습니다")
        return flows[0]["pk"]
