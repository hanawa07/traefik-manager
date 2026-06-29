from app.application.backup.backup_importer import BackupImporter
from app.application.backup.backup_preview import preview_backup_import
from app.application.backup.backup_serializers import serialize_redirect, serialize_service
from app.application.backup.backup_validator import validate_backup_payload
from app.domain.proxy.repositories.middleware_template_repository import (
    MiddlewareTemplateRepository,
)
from app.domain.proxy.repositories.redirect_host_repository import RedirectHostRepository
from app.domain.proxy.repositories.service_repository import ServiceRepository
from app.infrastructure.traefik.file_provider_writer import FileProviderWriter


class BackupUseCases:
    def __init__(
        self,
        service_repository: ServiceRepository,
        middleware_template_repository: MiddlewareTemplateRepository,
        redirect_repository: RedirectHostRepository,
        file_writer: FileProviderWriter,
    ):
        self.service_repository = service_repository
        self.middleware_template_repository = middleware_template_repository
        self.redirect_repository = redirect_repository
        self.file_writer = file_writer

    async def export_all(self) -> dict:
        services = await self.service_repository.find_all()
        redirects = await self.redirect_repository.find_all()

        return {
            "services": [serialize_service(item) for item in services],
            "redirect_hosts": [serialize_redirect(item) for item in redirects],
        }

    async def import_all(self, mode: str, payload: dict) -> dict:
        return await BackupImporter(
            service_repository=self.service_repository,
            middleware_template_repository=self.middleware_template_repository,
            redirect_repository=self.redirect_repository,
            file_writer=self.file_writer,
        ).import_all(mode, payload)

    async def validate_payload(self, payload: dict) -> dict:
        return await validate_backup_payload(payload, self.middleware_template_repository)

    async def preview_import(self, mode: str, payload: dict) -> dict:
        return await preview_backup_import(
            mode=mode,
            payload=payload,
            service_repository=self.service_repository,
            middleware_template_repository=self.middleware_template_repository,
            redirect_repository=self.redirect_repository,
        )
