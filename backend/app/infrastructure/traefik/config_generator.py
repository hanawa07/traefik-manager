import yaml
from app.core.config import settings
from app.domain.proxy.entities.middleware_template import MiddlewareTemplate
from app.domain.proxy.entities.redirect_host import RedirectHost
from app.domain.proxy.entities.service import Service
from app.infrastructure.traefik.dashboard_config_builder import (
    build_traefik_dashboard_public_route_config,
)
from app.infrastructure.traefik.redirect_config_builder import build_redirect_host_config
from app.infrastructure.traefik.service_config_builder import (
    build_frame_policy_headers,
    build_service_config,
)


class TraefikConfigGenerator:
    """서비스 도메인 객체를 Traefik 동적 설정 YAML로 변환"""

    AUTHENTIK_MIDDLEWARE = "authentik@file"
    AUTHENTIK_OUTPOST_SERVICE = "authentik-outpost@file"
    AUTHENTIK_OUTPOST_PATH_PREFIX = "/outpost.goauthentik.io/"
    TOKEN_AUTH_MIDDLEWARE_SUFFIX = "token-auth"

    def generate(
        self,
        service: Service,
        middleware_templates: list[MiddlewareTemplate] | None = None,
    ) -> dict:
        return build_service_config(
            service=service,
            middleware_templates=middleware_templates or [],
            safe_name_getter=self._to_safe_name,
            tls_config_builder=self._build_tls_config,
            token_auth_forward_auth_url=settings.TOKEN_AUTH_FORWARD_AUTH_URL,
            authentik_middleware=self.AUTHENTIK_MIDDLEWARE,
            authentik_outpost_service=self.AUTHENTIK_OUTPOST_SERVICE,
            authentik_outpost_path_prefix=self.AUTHENTIK_OUTPOST_PATH_PREFIX,
            token_auth_middleware_suffix=self.TOKEN_AUTH_MIDDLEWARE_SUFFIX,
        )

    def to_yaml(
        self,
        service: Service,
        middleware_templates: list[MiddlewareTemplate] | None = None,
    ) -> str:
        return yaml.dump(
            self.generate(service, middleware_templates=middleware_templates),
            default_flow_style=False,
            allow_unicode=True,
        )

    def generate_redirect_host(self, redirect_host: RedirectHost) -> dict:
        return build_redirect_host_config(
            redirect_host=redirect_host,
            safe_name_getter=self._to_safe_name,
            redirect_replacement_builder=self._build_redirect_replacement,
            tls_config_builder=self._build_tls_config,
        )

    def generate_traefik_dashboard_public_route(
        self,
        *,
        domain: str,
        basic_auth_username: str,
        basic_auth_password_hash: str,
    ) -> dict:
        return build_traefik_dashboard_public_route_config(
            domain=domain,
            basic_auth_username=basic_auth_username,
            basic_auth_password_hash=basic_auth_password_hash,
            tls_config_builder=self._build_tls_config,
        )

    def to_yaml_traefik_dashboard_public_route(
        self,
        *,
        domain: str,
        basic_auth_username: str,
        basic_auth_password_hash: str,
    ) -> str:
        return yaml.dump(
            self.generate_traefik_dashboard_public_route(
                domain=domain,
                basic_auth_username=basic_auth_username,
                basic_auth_password_hash=basic_auth_password_hash,
            ),
            default_flow_style=False,
            allow_unicode=True,
        )

    @staticmethod
    def _build_frame_policy_headers(frame_policy: str) -> dict:
        return build_frame_policy_headers(frame_policy)

    def to_yaml_redirect_host(self, redirect_host: RedirectHost) -> str:
        return yaml.dump(
            self.generate_redirect_host(redirect_host),
            default_flow_style=False,
            allow_unicode=True,
        )

    def _to_safe_name(self, domain: str) -> str:
        return domain.replace(".", "-").replace("_", "-")

    def _build_redirect_replacement(self, target_url: str) -> str:
        base = target_url.rstrip("/")
        return f"{base}${{1}}"

    @staticmethod
    def _build_tls_config() -> dict:
        tls_config: dict[str, str] = {}
        cert_resolver = (settings.TRAEFIK_TLS_CERT_RESOLVER or "").strip()
        if cert_resolver:
            tls_config["certResolver"] = cert_resolver
        return tls_config
