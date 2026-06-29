from uuid import UUID

from app.domain.proxy.entities.service import Service
from app.domain.proxy.repositories.service_repository import ServiceRepository
from app.domain.proxy.value_objects.service_id import ServiceId
from app.infrastructure.authentik.client import AuthentikClient


class ServiceAuthentikSync:
    def __init__(
        self,
        authentik_client: AuthentikClient,
        service_repository: ServiceRepository,
    ):
        self.authentik_client = authentik_client
        self.service_repository = service_repository

    async def list_groups(self) -> list[dict]:
        return await self.authentik_client.list_groups()

    async def setup(self, service: Service) -> None:
        slug = str(service.domain).replace(".", "-")
        provider = await self.authentik_client.create_proxy_provider(
            name=service.name,
            domain=str(service.domain),
        )
        application = await self.authentik_client.create_application(
            name=service.name,
            slug=slug,
            provider_pk=provider["pk"],
        )
        service.authentik_provider_id = str(provider["pk"])
        service.authentik_app_slug = slug
        await self.sync_group_policy(
            service=service,
            application_pk=str(application["pk"]),
        )

    async def sync_group_policy(
        self,
        service: Service,
        application_pk: str | None = None,
    ) -> None:
        await self.clear_group_policy(service)

        if not service.auth_enabled or not service.authentik_group_id:
            service.authentik_group_name = None
            return

        group = await self.authentik_client.get_group(service.authentik_group_id)
        if not group:
            raise ValueError("선택한 Authentik 그룹을 찾을 수 없습니다")

        if application_pk is None:
            if not service.authentik_app_slug:
                raise ValueError("Authentik 애플리케이션 정보가 없습니다")
            application = await self.authentik_client.get_application_by_slug(service.authentik_app_slug)
            if not application:
                raise ValueError("Authentik 애플리케이션을 찾을 수 없습니다")
            application_pk = str(application["pk"])

        policy = await self.authentik_client.create_group_policy(
            name=f"{service.name}-{service.domain}-group-policy",
            group_name=group["name"],
        )
        binding = await self.authentik_client.bind_policy_to_application(
            application_pk=application_pk,
            policy_pk=str(policy["pk"]),
        )
        service.authentik_group_name = group["name"]
        service.authentik_policy_id = str(policy["pk"])
        service.authentik_policy_binding_id = str(binding["pk"])

    async def clear_group_policy(self, service: Service) -> None:
        if service.authentik_policy_binding_id:
            await self.authentik_client.delete_policy_binding(service.authentik_policy_binding_id)
        if service.authentik_policy_id:
            await self.authentik_client.delete_policy(service.authentik_policy_id)
        service.authentik_policy_binding_id = None
        service.authentik_policy_id = None
        service.authentik_group_name = None

    async def teardown(self, service: Service) -> None:
        await self.clear_group_policy(service)
        if service.authentik_app_slug:
            await self.authentik_client.delete_application(service.authentik_app_slug)
        if service.authentik_provider_id:
            await self.authentik_client.delete_provider(service.authentik_provider_id)
        service.authentik_provider_id = None
        service.authentik_app_slug = None
        service.authentik_group_id = None

    async def count_services(self, exclude_id: UUID | ServiceId | None = None) -> int:
        excluded_value = exclude_id.value if isinstance(exclude_id, ServiceId) else exclude_id
        all_services = await self.service_repository.find_all()
        return sum(
            1
            for service in all_services
            if service.uses_authentik and (excluded_value is None or service.id.value != excluded_value)
        )
