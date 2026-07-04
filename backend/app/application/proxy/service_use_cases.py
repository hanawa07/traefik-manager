import logging
from uuid import UUID

from app.application.proxy.service_authentik_lifecycle import ServiceAuthentikLifecycle
from app.application.proxy.service_authentik_sync import ServiceAuthentikSync
from app.application.proxy.service_cloudflare_records import (
    delete_cloudflare_record,
    rollback_cloudflare_record,
    sync_cloudflare_record,
)
from app.application.proxy.service_middleware_templates import ServiceMiddlewareTemplateResolver
from app.application.proxy.service_payload_mapper import (
    apply_service_update_payload,
    create_service_from_payload,
)
from app.domain.proxy.entities.service import Service
from app.domain.proxy.repositories.middleware_template_repository import (
    MiddlewareTemplateRepository,
)
from app.domain.proxy.repositories.service_repository import ServiceRepository
from app.infrastructure.cloudflare.client import CloudflareClient
from app.infrastructure.traefik.file_provider_writer import FileProviderWriter
from app.infrastructure.authentik.client import AuthentikClient

logger = logging.getLogger(__name__)


class ServiceUseCases:

    def __init__(
        self,
        repository: ServiceRepository,
        middleware_template_repository: MiddlewareTemplateRepository,
        file_writer: FileProviderWriter,
        authentik_client: AuthentikClient,
        cloudflare_client: CloudflareClient,
        upstream_guard=None,
    ):
        self.repository = repository
        self.file_writer = file_writer
        self.authentik_sync = ServiceAuthentikSync(authentik_client, repository)
        self.authentik_lifecycle = ServiceAuthentikLifecycle(self.authentik_sync, file_writer)
        self.middleware_templates = ServiceMiddlewareTemplateResolver(middleware_template_repository)
        self.cloudflare_client = cloudflare_client
        self.upstream_guard = upstream_guard

    async def list_services(self) -> list[Service]:
        return await self.repository.find_all()

    async def get_service(self, service_id: UUID) -> Service | None:
        return await self.repository.find_by_id(service_id)

    async def create_service(self, data) -> Service:
        # 도메인 중복 확인
        existing = await self.repository.find_by_domain(data.domain)
        if existing:
            raise ValueError(f"이미 등록된 도메인입니다: {data.domain}")

        if self.upstream_guard is not None:
            await self.upstream_guard.ensure_safe(data.upstream_host)

        service = create_service_from_payload(data)
        middleware_templates = await self.middleware_templates.resolve(service.middleware_template_ids)
        self.middleware_templates.validate_auth_conflict(service, middleware_templates)

        await self.authentik_lifecycle.setup_created_service(service)

        # Cloudflare DNS 자동 등록 (선택 기능)
        await sync_cloudflare_record(self.cloudflare_client, service)

        try:
            # Traefik YAML 생성
            await self._sync_shared_middleware_templates()
            self.file_writer.write(service, middleware_templates=middleware_templates)
            await self.repository.save(service)
        except Exception:
            logger.exception(
                "서비스 생성 실패",
                extra={
                    "service_name": service.name,
                    "domain": str(service.domain),
                },
            )
            # 저장 단계에서 실패하면 생성한 리소스를 최대한 정리한다.
            try:
                self.file_writer.delete(service)
            except Exception:
                logger.exception(
                    "Traefik 설정 롤백 실패",
                    extra={"domain": str(service.domain)},
                )
            await rollback_cloudflare_record(self.cloudflare_client, service)
            raise

        logger.info("서비스 생성: domain=%s", service.domain)
        return service

    async def update_service(self, service_id: UUID, data) -> Service | None:
        service = await self.repository.find_by_id(service_id)
        if not service:
            return None

        update_payload = data.model_dump(exclude_unset=True)
        old_auth_mode = service.auth_mode
        previous_group_id = service.authentik_group_id

        if self.upstream_guard is not None and "upstream_host" in update_payload:
            await self.upstream_guard.ensure_safe(update_payload["upstream_host"])

        apply_service_update_payload(service, update_payload)
        middleware_templates = await self.middleware_templates.resolve(service.middleware_template_ids)
        self.middleware_templates.validate_auth_conflict(service, middleware_templates)

        await self.authentik_lifecycle.sync_updated_service(
            service=service,
            old_auth_mode=old_auth_mode,
            previous_group_id=previous_group_id,
        )

        # Cloudflare가 활성화되어 있으면 레코드도 현재 서비스 상태로 동기화한다.
        await sync_cloudflare_record(
            self.cloudflare_client,
            service,
            require_enabled=True,
            include_service_id=True,
        )

        # Traefik YAML 업데이트
        await self._sync_shared_middleware_templates()
        self.file_writer.write(service, middleware_templates=middleware_templates)
        await self.repository.save(service)
        logger.info("서비스 수정: id=%s", service_id)
        return service

    async def delete_service(self, service_id: UUID) -> None:
        service = await self.repository.find_by_id(service_id)
        if not service:
            return

        await self.authentik_lifecycle.teardown_deleted_service(service)

        await delete_cloudflare_record(self.cloudflare_client, service)

        self.file_writer.delete(service)
        service.delete()
        await self.repository.delete(service_id)
        
        await self.authentik_lifecycle.cleanup_deleted_service(service)
            
        logger.info("서비스 삭제: id=%s", service_id)

    async def list_authentik_groups(self) -> list[dict]:
        return await self.authentik_sync.list_groups()

    async def _sync_shared_middleware_templates(self) -> None:
        self.file_writer.write_shared_middleware_templates(await self.middleware_templates.list_all())
