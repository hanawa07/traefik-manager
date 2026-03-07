from uuid import UUID

from app.domain.proxy.entities.redirect_host import RedirectHost
from app.domain.proxy.repositories.redirect_host_repository import RedirectHostRepository
from app.domain.proxy.repositories.service_repository import ServiceRepository
from app.infrastructure.traefik.file_provider_writer import FileProviderWriter


class RedirectHostUseCases:

    def __init__(
        self,
        repository: RedirectHostRepository,
        service_repository: ServiceRepository,
        file_writer: FileProviderWriter,
    ):
        self.repository = repository
        self.service_repository = service_repository
        self.file_writer = file_writer

    async def list_redirect_hosts(self) -> list[RedirectHost]:
        return await self.repository.find_all()

    async def get_redirect_host(self, redirect_id: UUID) -> RedirectHost | None:
        return await self.repository.find_by_id(redirect_id)

    async def create_redirect_host(self, data) -> RedirectHost:
        await self._validate_domain_available(data.domain)

        redirect_host = RedirectHost.create(
            domain=data.domain,
            target_url=data.target_url,
            permanent=data.permanent,
            tls_enabled=data.tls_enabled,
        )
        self.file_writer.write_redirect_host(redirect_host)
        await self.repository.save(redirect_host)
        return redirect_host

    async def update_redirect_host(self, redirect_id: UUID, data) -> RedirectHost | None:
        redirect_host = await self.repository.find_by_id(redirect_id)
        if not redirect_host:
            return None

        update_payload = data.model_dump(exclude_unset=True)
        previous_domain = str(redirect_host.domain)
        target_domain = update_payload.get("domain")
        if target_domain and target_domain != previous_domain:
            await self._validate_domain_available(target_domain)

        redirect_host.update(
            domain=update_payload.get("domain"),
            target_url=update_payload.get("target_url"),
            permanent=update_payload.get("permanent"),
            tls_enabled=update_payload.get("tls_enabled"),
        )

        if previous_domain != str(redirect_host.domain):
            self.file_writer.delete_redirect_host_by_domain(previous_domain)

        self.file_writer.write_redirect_host(redirect_host)
        await self.repository.save(redirect_host)
        return redirect_host

    async def delete_redirect_host(self, redirect_id: UUID) -> None:
        redirect_host = await self.repository.find_by_id(redirect_id)
        if not redirect_host:
            return

        self.file_writer.delete_redirect_host(redirect_host)
        await self.repository.delete(redirect_id)

    async def _validate_domain_available(self, domain: str) -> None:
        existing_redirect = await self.repository.find_by_domain(domain)
        if existing_redirect:
            raise ValueError(f"이미 리다이렉트가 등록된 도메인입니다: {domain}")

        existing_service = await self.service_repository.find_by_domain(domain)
        if existing_service:
            raise ValueError(f"이미 서비스로 등록된 도메인입니다: {domain}")
