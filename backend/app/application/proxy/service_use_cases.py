import logging
from uuid import UUID

from app.application.proxy.basic_auth_credentials import hash_basic_auth_credentials
from app.application.proxy.service_authentik_lifecycle import ServiceAuthentikLifecycle
from app.application.proxy.service_authentik_sync import ServiceAuthentikSync
from app.application.proxy.service_cloudflare_records import (
    delete_cloudflare_record,
    rollback_cloudflare_record,
    sync_cloudflare_record,
)
from app.domain.proxy.entities.middleware_template import MiddlewareTemplate
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
        self.middleware_template_repository = middleware_template_repository
        self.file_writer = file_writer
        self.authentik_sync = ServiceAuthentikSync(authentik_client, repository)
        self.authentik_lifecycle = ServiceAuthentikLifecycle(self.authentik_sync, file_writer)
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

        service = Service.create(
            name=data.name,
            domain=data.domain,
            upstream_host=data.upstream_host,
            upstream_port=data.upstream_port,
            tls_enabled=data.tls_enabled,
            auth_mode=data.auth_mode,
            api_key=data.api_key,
            https_redirect_enabled=data.https_redirect_enabled,
            allowed_ips=data.allowed_ips,
            blocked_paths=data.blocked_paths,
            rate_limit_average=data.rate_limit_average,
            rate_limit_burst=data.rate_limit_burst,
            custom_headers=data.custom_headers,
            basic_auth_users=(
                hash_basic_auth_credentials(data.basic_auth_credentials)
                if data.basic_auth_enabled
                else []
            ),
            middleware_template_ids=data.middleware_template_ids,
            authentik_group_id=data.authentik_group_id,
            upstream_scheme=data.upstream_scheme,
            skip_tls_verify=data.skip_tls_verify,
            frame_policy=data.frame_policy,
            healthcheck_enabled=getattr(data, "healthcheck_enabled", True),
            healthcheck_path=getattr(data, "healthcheck_path", "/"),
            healthcheck_timeout_ms=getattr(data, "healthcheck_timeout_ms", 3000),
            healthcheck_expected_statuses=getattr(data, "healthcheck_expected_statuses", []),
        )
        middleware_templates = await self._resolve_middleware_templates(service.middleware_template_ids)
        self._validate_template_auth_conflict(service, middleware_templates)

        await self.authentik_lifecycle.setup_created_service(service)

        # Cloudflare DNS 자동 등록 (선택 기능)
        await sync_cloudflare_record(self.cloudflare_client, service)

        try:
            # Traefik YAML 생성
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
        clear_rate_limit = update_payload.get("rate_limit_enabled") is False

        if (
            update_payload.get("basic_auth_enabled") is True
            and not service.basic_auth_enabled
            and "basic_auth_credentials" not in update_payload
        ):
            raise ValueError("Basic Auth를 활성화하려면 사용자 이름과 비밀번호를 입력해야 합니다")

        basic_auth_users = None
        if update_payload.get("basic_auth_enabled") is False:
            basic_auth_users = []
        elif "basic_auth_credentials" in update_payload:
            basic_auth_users = hash_basic_auth_credentials(
                update_payload.get("basic_auth_credentials") or [],
                existing_users=service.basic_auth_users
            )

        if self.upstream_guard is not None and "upstream_host" in update_payload:
            await self.upstream_guard.ensure_safe(update_payload["upstream_host"])

        service.update(
            name=update_payload.get("name"),
            upstream_host=update_payload.get("upstream_host"),
            upstream_port=update_payload.get("upstream_port"),
            tls_enabled=update_payload.get("tls_enabled"),
            auth_mode=update_payload.get("auth_mode"),
            api_key=update_payload.get("api_key"),
            https_redirect_enabled=update_payload.get("https_redirect_enabled"),
            allowed_ips=update_payload.get("allowed_ips"),
            blocked_paths=update_payload.get("blocked_paths"),
            rate_limit_average=update_payload.get("rate_limit_average"),
            rate_limit_burst=update_payload.get("rate_limit_burst"),
            custom_headers=update_payload.get("custom_headers"),
            basic_auth_users=basic_auth_users,
            middleware_template_ids=update_payload.get("middleware_template_ids"),
            clear_rate_limit=clear_rate_limit,
            upstream_scheme=update_payload.get("upstream_scheme"),
            skip_tls_verify=update_payload.get("skip_tls_verify"),
            frame_policy=update_payload.get("frame_policy"),
            healthcheck_enabled=update_payload.get("healthcheck_enabled"),
            healthcheck_path=update_payload.get("healthcheck_path"),
            healthcheck_timeout_ms=update_payload.get("healthcheck_timeout_ms"),
            healthcheck_expected_statuses=update_payload.get("healthcheck_expected_statuses"),
        )
        middleware_templates = await self._resolve_middleware_templates(service.middleware_template_ids)
        self._validate_template_auth_conflict(service, middleware_templates)

        if "authentik_group_id" in update_payload:
            service.authentik_group_id = (
                update_payload.get("authentik_group_id") if service.uses_authentik else None
            )

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

    async def _resolve_middleware_templates(self, template_ids: list[str]) -> list[MiddlewareTemplate]:
        if not template_ids:
            return []

        parsed_ids: list[UUID] = []
        for item in template_ids:
            try:
                parsed_ids.append(UUID(item))
            except ValueError as exc:
                raise ValueError(f"유효하지 않은 미들웨어 템플릿 ID입니다: {item}") from exc

        templates = await self.middleware_template_repository.find_many_by_ids(parsed_ids)
        template_map = {str(item.id): item for item in templates}

        resolved: list[MiddlewareTemplate] = []
        for template_id in template_ids:
            template = template_map.get(template_id)
            if not template:
                raise ValueError(f"미들웨어 템플릿을 찾을 수 없습니다: {template_id}")
            resolved.append(template)
        return resolved

    def _validate_template_auth_conflict(
        self,
        service: Service,
        templates: list[MiddlewareTemplate],
    ) -> None:
        if not service.auth_enabled:
            return
        if any(template.type == "basicAuth" for template in templates):
            raise ValueError("인증 모드와 BasicAuth 미들웨어 템플릿은 동시에 사용할 수 없습니다")
