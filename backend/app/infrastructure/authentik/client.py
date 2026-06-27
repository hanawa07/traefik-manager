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
        self.timeout = 10.0

    async def _request(
        self,
        method: str,
        path: str,
        *,
        client: httpx.AsyncClient | None = None,
        raise_for_status: bool = True,
        **kwargs,
    ) -> httpx.Response:
        if client is None:
            async with httpx.AsyncClient() as new_client:
                return await self._request(
                    method,
                    path,
                    client=new_client,
                    raise_for_status=raise_for_status,
                    **kwargs,
                )

        response = await client.request(
            method,
            f"{self.base_url}{path}",
            headers=self.headers,
            timeout=self.timeout,
            **kwargs,
        )
        if raise_for_status:
            response.raise_for_status()
        return response

    async def create_proxy_provider(self, name: str, domain: str) -> dict:
        """Forward Auth 프로바이더 생성"""
        async with httpx.AsyncClient() as client:
            response = await self._request(
                "POST",
                "/providers/proxy/",
                client=client,
                json={
                    "name": name,
                    "external_host": f"https://{domain}",
                    "mode": "forward_single",
                    "authorization_flow": await self._get_default_auth_flow(client),
                    "invalidation_flow": await self._get_default_invalidation_flow(client),
                },
            )
            return response.json()

    async def create_application(self, name: str, slug: str, provider_pk: int) -> dict:
        """Authentik 애플리케이션 생성"""
        response = await self._request(
            "POST",
            "/core/applications/",
            json={
                "name": name,
                "slug": slug,
                "provider": provider_pk,
            },
        )
        return response.json()

    async def get_application_by_slug(self, slug: str) -> dict | None:
        response = await self._request("GET", f"/core/applications/?slug={slug}")
        data = response.json()
        results = data.get("results", []) if isinstance(data, dict) else []
        if not results:
            return None
        return results[0]

    async def list_groups(self) -> list[dict]:
        """Authentik 그룹 목록 조회"""
        response = await self._request("GET", "/core/groups/")
        data = response.json()
        results = data.get("results", []) if isinstance(data, dict) else []
        groups: list[dict] = []
        for item in results:
            pk = item.get("pk")
            name = item.get("name")
            if pk is None or not name:
                continue
            groups.append({"id": str(pk), "name": str(name)})
        return groups

    async def get_group(self, group_id: str) -> dict | None:
        groups = await self.list_groups()
        for group in groups:
            if group["id"] == str(group_id):
                return group
        return None

    async def create_group_policy(self, name: str, group_name: str) -> dict:
        """그룹 기반 접근 제어 Policy 생성"""
        escaped_group_name = group_name.replace('"', '\\"')
        expression = (
            f'return request.user.is_authenticated and '
            f'request.user.ak_groups.filter(name="{escaped_group_name}").exists()'
        )

        response = await self._request(
            "POST",
            "/policies/expression/",
            json={
                "name": name,
                "expression": expression,
            },
        )
        return response.json()

    async def bind_policy_to_application(self, application_pk: str, policy_pk: str) -> dict:
        """생성된 Policy를 애플리케이션에 바인딩"""
        response = await self._request(
            "POST",
            "/policies/bindings/",
            json={
                "target": application_pk,
                "policy": policy_pk,
                "order": 0,
                "enabled": True,
                "negate": False,
                "timeout": 30,
            },
        )
        return response.json()

    async def delete_policy_binding(self, binding_id: str) -> None:
        await self._request("DELETE", f"/policies/bindings/{binding_id}/", raise_for_status=False)

    async def delete_policy(self, policy_id: str) -> None:
        await self._request("DELETE", f"/policies/expression/{policy_id}/", raise_for_status=False)

    async def delete_application(self, slug: str) -> None:
        await self._request("DELETE", f"/core/applications/{slug}/", raise_for_status=False)

    async def delete_provider(self, provider_id: int | str) -> None:
        await self._request("DELETE", f"/providers/proxy/{provider_id}/", raise_for_status=False)

    async def _get_default_auth_flow(self, client: httpx.AsyncClient) -> str:
        response = await self._request(
            "GET",
            "/flows/instances/?designation=authorization",
            client=client,
        )
        flows = response.json()["results"]
        if not flows:
            raise ValueError("Authentik에 인증 플로우가 없습니다")
        return flows[0]["pk"]

    async def _get_default_invalidation_flow(self, client: httpx.AsyncClient) -> str:
        response = await self._request(
            "GET",
            "/flows/instances/?designation=invalidation",
            client=client,
        )
        flows = response.json()["results"]
        if not flows:
            raise ValueError("Authentik에 무효화 플로우가 없습니다")
        return flows[0]["pk"]
