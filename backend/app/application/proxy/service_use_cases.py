from uuid import UUID

from app.domain.proxy.entities.service import Service
from app.domain.proxy.repositories.service_repository import ServiceRepository
from app.infrastructure.traefik.file_provider_writer import FileProviderWriter
from app.infrastructure.authentik.client import AuthentikClient


class ServiceUseCases:

    def __init__(
        self,
        repository: ServiceRepository,
        file_writer: FileProviderWriter,
        authentik_client: AuthentikClient,
    ):
        self.repository = repository
        self.file_writer = file_writer
        self.authentik_client = authentik_client

    async def list_services(self) -> list[Service]:
        return await self.repository.find_all()

    async def get_service(self, service_id: UUID) -> Service | None:
        return await self.repository.find_by_id(service_id)

    async def create_service(self, data) -> Service:
        # 도메인 중복 확인
        existing = await self.repository.find_by_domain(data.domain)
        if existing:
            raise ValueError(f"이미 등록된 도메인입니다: {data.domain}")

        service = Service.create(
            name=data.name,
            domain=data.domain,
            upstream_host=data.upstream_host,
            upstream_port=data.upstream_port,
            tls_enabled=data.tls_enabled,
            auth_enabled=data.auth_enabled,
            https_redirect_enabled=data.https_redirect_enabled,
            allowed_ips=data.allowed_ips,
            authentik_group_id=data.authentik_group_id,
        )

        # Authentik 연동 (인증 활성화 시)
        if service.auth_enabled:
            await self._setup_authentik(service)

        # Traefik YAML 생성
        self.file_writer.write(service)

        await self.repository.save(service)
        return service

    async def update_service(self, service_id: UUID, data) -> Service | None:
        service = await self.repository.find_by_id(service_id)
        if not service:
            return None

        update_payload = data.model_dump(exclude_unset=True)
        was_auth_enabled = service.auth_enabled
        previous_group_id = service.authentik_group_id
        service.update(
            name=update_payload.get("name"),
            upstream_host=update_payload.get("upstream_host"),
            upstream_port=update_payload.get("upstream_port"),
            tls_enabled=update_payload.get("tls_enabled"),
            auth_enabled=update_payload.get("auth_enabled"),
            https_redirect_enabled=update_payload.get("https_redirect_enabled"),
            allowed_ips=update_payload.get("allowed_ips"),
        )

        if "authentik_group_id" in update_payload:
            service.authentik_group_id = (
                update_payload.get("authentik_group_id") if service.auth_enabled else None
            )

        # 인증 상태 변경 처리
        if "auth_enabled" in update_payload:
            if update_payload["auth_enabled"] and not was_auth_enabled:
                await self._setup_authentik(service)
            elif not update_payload["auth_enabled"] and was_auth_enabled:
                await self._teardown_authentik(service)
        elif service.auth_enabled and previous_group_id != service.authentik_group_id:
            await self._sync_authentik_group_policy(service)

        # Traefik YAML 업데이트
        self.file_writer.write(service)
        await self.repository.save(service)
        return service

    async def delete_service(self, service_id: UUID) -> None:
        service = await self.repository.find_by_id(service_id)
        if not service:
            return

        if service.auth_enabled:
            await self._teardown_authentik(service)

        self.file_writer.delete(service)
        service.delete()
        await self.repository.delete(service_id)

    async def list_authentik_groups(self) -> list[dict]:
        return await self.authentik_client.list_groups()

    async def _setup_authentik(self, service: Service) -> None:
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
        await self._sync_authentik_group_policy(
            service=service,
            application_pk=str(application["pk"]),
        )

    async def _sync_authentik_group_policy(
        self,
        service: Service,
        application_pk: str | None = None,
    ) -> None:
        await self._clear_authentik_group_policy(service)

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

    async def _clear_authentik_group_policy(self, service: Service) -> None:
        if service.authentik_policy_binding_id:
            await self.authentik_client.delete_policy_binding(service.authentik_policy_binding_id)
        if service.authentik_policy_id:
            await self.authentik_client.delete_policy(service.authentik_policy_id)
        service.authentik_policy_binding_id = None
        service.authentik_policy_id = None
        service.authentik_group_name = None

    async def _teardown_authentik(self, service: Service) -> None:
        await self._clear_authentik_group_policy(service)
        if service.authentik_app_slug:
            await self.authentik_client.delete_application(service.authentik_app_slug)
        if service.authentik_provider_id:
            await self.authentik_client.delete_provider(service.authentik_provider_id)
        service.authentik_provider_id = None
        service.authentik_app_slug = None
        service.authentik_group_id = None
