import logging

from app.application.proxy.service_authentik_sync import ServiceAuthentikSync
from app.domain.proxy.entities.service import Service

logger = logging.getLogger(__name__)


class ServiceAuthentikLifecycle:
    def __init__(self, authentik_sync: ServiceAuthentikSync, file_writer):
        self.authentik_sync = authentik_sync
        self.file_writer = file_writer

    async def setup_created_service(self, service: Service) -> None:
        if not service.uses_authentik:
            return

        try:
            await self.authentik_sync.setup(service)
        except Exception:
            logger.warning(
                "Authentik 연동 실패",
                extra={
                    "service_name": service.name,
                    "domain": str(service.domain),
                },
            )
            raise
        self.file_writer.write_authentik_middleware()

    async def sync_updated_service(
        self,
        service: Service,
        old_auth_mode: str,
        previous_group_id: str | None,
    ) -> None:
        new_auth_mode = service.auth_mode
        if old_auth_mode != new_auth_mode:
            await self._sync_auth_mode_change(service, old_auth_mode, new_auth_mode)
        elif service.uses_authentik and previous_group_id != service.authentik_group_id:
            await self._sync_group_policy(service)

    async def teardown_deleted_service(self, service: Service) -> None:
        if not service.uses_authentik:
            return

        await self._teardown_service_authentik(service)

    async def cleanup_deleted_service(self, service: Service) -> None:
        if not service.uses_authentik:
            return

        remaining = await self.authentik_sync.count_services(exclude_id=service.id)
        self.file_writer.delete_authentik_middleware_if_unused(remaining)

    async def _teardown_service_authentik(self, service: Service) -> None:
        try:
            await self.authentik_sync.teardown(service)
        except Exception:
            logger.warning(
                "Authentik 연동 해제 실패",
                extra={
                    "service_id": str(service.id),
                    "service_name": service.name,
                    "domain": str(service.domain),
                },
            )
            raise

    async def _sync_auth_mode_change(
        self,
        service: Service,
        old_auth_mode: str,
        new_auth_mode: str,
    ) -> None:
        if old_auth_mode == "authentik":
            await self._teardown_service_authentik(service)
            remaining = await self.authentik_sync.count_services(exclude_id=service.id)
            self.file_writer.delete_authentik_middleware_if_unused(remaining)

        if new_auth_mode == "authentik":
            try:
                await self.authentik_sync.setup(service)
            except Exception:
                logger.warning(
                    "Authentik 연동 실패",
                    extra={
                        "service_id": str(service.id),
                        "service_name": service.name,
                        "domain": str(service.domain),
                    },
                )
                raise
            self.file_writer.write_authentik_middleware()

    async def _sync_group_policy(self, service: Service) -> None:
        try:
            await self.authentik_sync.sync_group_policy(service)
        except Exception:
            logger.warning(
                "Authentik 그룹 정책 동기화 실패",
                extra={
                    "service_id": str(service.id),
                    "service_name": service.name,
                    "domain": str(service.domain),
                },
            )
            raise
