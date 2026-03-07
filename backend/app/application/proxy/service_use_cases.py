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
            auth_enabled=data.auth_enabled,
            https_redirect_enabled=data.https_redirect_enabled,
            allowed_ips=data.allowed_ips,
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
        )
        middleware_templates = await self._resolve_middleware_templates(service.middleware_template_ids)
        self._validate_template_auth_conflict(service, middleware_templates)

        # Authentik 연동 (인증 활성화 시)
        if service.auth_enabled:
            await self._setup_authentik(service)

        # Cloudflare DNS 자동 등록 (선택 기능)
        service.cloudflare_record_id = await self.cloudflare_client.upsert_service_record(
            domain=str(service.domain),
            fallback_target=service.upstream_host,
        )

        try:
            # Traefik YAML 생성
            self.file_writer.write(service, middleware_templates=middleware_templates)
            await self.repository.save(service)
        except Exception:
            # 저장 단계에서 실패하면 생성한 리소스를 최대한 정리한다.
            try:
                self.file_writer.delete(service)
            except Exception:
                pass
            if service.cloudflare_record_id:
                try:
                    await self.cloudflare_client.delete_service_record(
                        domain=str(service.domain),
                        record_id=service.cloudflare_record_id,
                    )
                except Exception:
                    pass
            raise

        return service

    async def update_service(self, service_id: UUID, data) -> Service | None:
        service = await self.repository.find_by_id(service_id)
        if not service:
            return None

        update_payload = data.model_dump(exclude_unset=True)
        was_auth_enabled = service.auth_enabled
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
            auth_enabled=update_payload.get("auth_enabled"),
            https_redirect_enabled=update_payload.get("https_redirect_enabled"),
            allowed_ips=update_payload.get("allowed_ips"),
            rate_limit_average=update_payload.get("rate_limit_average"),
            rate_limit_burst=update_payload.get("rate_limit_burst"),
            custom_headers=update_payload.get("custom_headers"),
            basic_auth_users=basic_auth_users,
            middleware_template_ids=update_payload.get("middleware_template_ids"),
            clear_rate_limit=clear_rate_limit,
        )
        middleware_templates = await self._resolve_middleware_templates(service.middleware_template_ids)
        self._validate_template_auth_conflict(service, middleware_templates)

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

        # Cloudflare가 활성화되어 있으면 레코드도 현재 서비스 상태로 동기화한다.
        if self.cloudflare_client.enabled:
            service.cloudflare_record_id = await self.cloudflare_client.upsert_service_record(
                domain=str(service.domain),
                fallback_target=service.upstream_host,
            )

        # Traefik YAML 업데이트
        self.file_writer.write(service, middleware_templates=middleware_templates)
        await self.repository.save(service)
        return service

    async def delete_service(self, service_id: UUID) -> None:
        service = await self.repository.find_by_id(service_id)
        if not service:
            return

        if service.auth_enabled:
            await self._teardown_authentik(service)

        await self.cloudflare_client.delete_service_record(
            domain=str(service.domain),
            record_id=service.cloudflare_record_id,
        )

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
            raise ValueError("Authentik 인증과 BasicAuth 미들웨어 템플릿은 동시에 사용할 수 없습니다")
