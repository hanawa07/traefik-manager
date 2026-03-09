import logging
from uuid import UUID

from passlib.hash import apr_md5_crypt

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
    ):
        self.repository = repository
        self.middleware_template_repository = middleware_template_repository
        self.file_writer = file_writer
        self.authentik_client = authentik_client
        self.cloudflare_client = cloudflare_client

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
            auth_mode=data.auth_mode,
            api_key=data.api_key,
            https_redirect_enabled=data.https_redirect_enabled,
            allowed_ips=data.allowed_ips,
            blocked_paths=data.blocked_paths,
            rate_limit_average=data.rate_limit_average,
            rate_limit_burst=data.rate_limit_burst,
            custom_headers=data.custom_headers,
            basic_auth_users=(
                self._hash_basic_auth_credentials(data.basic_auth_credentials)
                if data.basic_auth_enabled
                else []
            ),
            middleware_template_ids=data.middleware_template_ids,
            authentik_group_id=data.authentik_group_id,
            upstream_scheme=data.upstream_scheme,
            skip_tls_verify=data.skip_tls_verify,
        )
        middleware_templates = await self._resolve_middleware_templates(service.middleware_template_ids)
        self._validate_template_auth_conflict(service, middleware_templates)

        # Authentik 연동 (authentik 모드 활성화 시)
        if service.uses_authentik:
            try:
                await self._setup_authentik(service)
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

        # Cloudflare DNS 자동 등록 (선택 기능)
        try:
            service.cloudflare_record_id = await self.cloudflare_client.upsert_service_record(
                domain=str(service.domain),
                fallback_target=service.upstream_host,
            )
        except Exception:
            logger.warning(
                "Cloudflare DNS 연동 실패",
                extra={
                    "service_name": service.name,
                    "domain": str(service.domain),
                },
            )
            raise

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
            if service.cloudflare_record_id:
                try:
                    await self.cloudflare_client.delete_service_record(
                        domain=str(service.domain),
                        record_id=service.cloudflare_record_id,
                    )
                except Exception:
                    logger.warning(
                        "Cloudflare DNS 롤백 실패",
                        extra={
                            "domain": str(service.domain),
                            "cloudflare_record_id": service.cloudflare_record_id,
                        },
                    )
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
            basic_auth_users = self._hash_basic_auth_credentials(
                update_payload.get("basic_auth_credentials") or []
            )

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
        )
        middleware_templates = await self._resolve_middleware_templates(service.middleware_template_ids)
        self._validate_template_auth_conflict(service, middleware_templates)

        if "authentik_group_id" in update_payload:
            service.authentik_group_id = (
                update_payload.get("authentik_group_id") if service.uses_authentik else None
            )

        # 인증 모드 변경 처리
        new_auth_mode = service.auth_mode
        if old_auth_mode != new_auth_mode:
            # 1. Authentik teardown (기존이 authentik이었던 경우)
            if old_auth_mode == "authentik":
                try:
                    await self._teardown_authentik(service)
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
                remaining = await self._count_authentik_services(exclude_id=service.id)
                self.file_writer.delete_authentik_middleware_if_unused(remaining)

            # 2. Authentik setup (새로운 모드가 authentik인 경우)
            if new_auth_mode == "authentik":
                try:
                    await self._setup_authentik(service)
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
        elif service.uses_authentik and previous_group_id != service.authentik_group_id:
            try:
                await self._sync_authentik_group_policy(service)
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

        # Cloudflare가 활성화되어 있으면 레코드도 현재 서비스 상태로 동기화한다.
        if self.cloudflare_client.enabled:
            try:
                service.cloudflare_record_id = await self.cloudflare_client.upsert_service_record(
                    domain=str(service.domain),
                    fallback_target=service.upstream_host,
                )
            except Exception:
                logger.warning(
                    "Cloudflare DNS 연동 실패",
                    extra={
                        "service_id": str(service.id),
                        "service_name": service.name,
                        "domain": str(service.domain),
                    },
                )
                raise

        # Traefik YAML 업데이트
        self.file_writer.write(service, middleware_templates=middleware_templates)
        await self.repository.save(service)
        logger.info("서비스 수정: id=%s", service_id)
        return service

    async def delete_service(self, service_id: UUID) -> None:
        service = await self.repository.find_by_id(service_id)
        if not service:
            return

        if service.uses_authentik:
            try:
                await self._teardown_authentik(service)
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

        try:
            await self.cloudflare_client.delete_service_record(
                domain=str(service.domain),
                record_id=service.cloudflare_record_id,
            )
        except Exception:
            logger.warning(
                "Cloudflare DNS 삭제 실패",
                extra={
                    "service_id": str(service.id),
                    "service_name": service.name,
                    "domain": str(service.domain),
                    "cloudflare_record_id": service.cloudflare_record_id,
                },
            )
            raise

        self.file_writer.delete(service)
        service.delete()
        await self.repository.delete(service_id)
        
        if service.uses_authentik:
            remaining = await self._count_authentik_services(exclude_id=service.id)
            self.file_writer.delete_authentik_middleware_if_unused(remaining)
            
        logger.info("서비스 삭제: id=%s", service_id)

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

    def _hash_basic_auth_credentials(self, credentials: list[dict]) -> list[str]:
        if not credentials:
            return []

        users: list[str] = []
        seen_usernames: set[str] = set()
        for item in credentials:
            if isinstance(item, dict):
                username = str(item.get("username", "")).strip()
                password = str(item.get("password", ""))
            else:
                username = str(getattr(item, "username", "")).strip()
                password = str(getattr(item, "password", ""))
            if not username or not password:
                continue
            if username in seen_usernames:
                raise ValueError(f"중복된 Basic Auth 사용자 이름입니다: {username}")
            seen_usernames.add(username)
            users.append(f"{username}:{apr_md5_crypt.hash(password)}")

        return users

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

    async def _count_authentik_services(self, exclude_id=None) -> int:
        """Authentik 인증이 활성화된 서비스 수를 반환한다 (exclude_id 서비스 제외)."""
        all_services = await self.repository.find_all()
        return sum(
            1 for s in all_services
            if s.uses_authentik and (exclude_id is None or s.id.value != exclude_id)
        )
