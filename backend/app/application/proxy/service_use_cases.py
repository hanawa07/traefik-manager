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

        was_auth_enabled = service.auth_enabled
        service.update(
            name=data.name,
            upstream_host=data.upstream_host,
            upstream_port=data.upstream_port,
            tls_enabled=data.tls_enabled,
            auth_enabled=data.auth_enabled,
        )

        # 인증 상태 변경 처리
        if data.auth_enabled is not None:
            if data.auth_enabled and not was_auth_enabled:
                await self._setup_authentik(service)
            elif not data.auth_enabled and was_auth_enabled:
                await self._teardown_authentik(service)

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

    async def _setup_authentik(self, service: Service) -> None:
        slug = str(service.domain).replace(".", "-")
        provider = await self.authentik_client.create_proxy_provider(
            name=service.name,
            domain=str(service.domain),
        )
        await self.authentik_client.create_application(
            name=service.name,
            slug=slug,
            provider_pk=provider["pk"],
        )
        service.authentik_provider_id = str(provider["pk"])
        service.authentik_app_slug = slug

    async def _teardown_authentik(self, service: Service) -> None:
        if service.authentik_app_slug:
            await self.authentik_client.delete_application(service.authentik_app_slug)
        if service.authentik_provider_id:
            await self.authentik_client.delete_provider(int(service.authentik_provider_id))
        service.authentik_provider_id = None
        service.authentik_app_slug = None
