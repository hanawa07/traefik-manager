import re

import yaml
from app.core.config import settings
from app.domain.proxy.entities.middleware_template import MiddlewareTemplate
from app.domain.proxy.entities.redirect_host import RedirectHost
from app.domain.proxy.entities.service import Service


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
        templates = middleware_templates or []
        router_name = self._to_safe_name(str(service.domain))
        upstream_url = f"{service.upstream_scheme}://{service.upstream}"
        ip_allowlist_name = f"{router_name}-ipallowlist"
        redirect_middleware_name = f"{router_name}-redirectscheme"
        rate_limit_name = f"{router_name}-ratelimit"
        custom_headers_name = f"{router_name}-response-headers"
        frame_policy_name = f"{router_name}-frame-policy"
        basic_auth_name = f"{router_name}-basicauth"
        token_auth_middleware_name = f"{router_name}-{self.TOKEN_AUTH_MIDDLEWARE_SUFFIX}"

        middlewares: dict = {}
        router_middlewares: list[str] = []

        if service.allowed_ips:
            middlewares[ip_allowlist_name] = {
                "ipAllowList": {
                    "sourceRange": service.allowed_ips,
                }
            }
            router_middlewares.append(ip_allowlist_name)

        if service.rate_limit_enabled:
            middlewares[rate_limit_name] = {
                "rateLimit": {
                    "average": service.rate_limit_average,
                    "burst": service.rate_limit_burst,
                }
            }
            router_middlewares.append(rate_limit_name)

        if service.custom_headers:
            middlewares[custom_headers_name] = {
                "headers": {
                    "customResponseHeaders": service.custom_headers,
                }
            }
            router_middlewares.append(custom_headers_name)

        if service.frame_policy != "off":
            middlewares[frame_policy_name] = {
                "headers": self._build_frame_policy_headers(service.frame_policy),
            }
            router_middlewares.append(frame_policy_name)

        if service.basic_auth_users:
            middlewares[basic_auth_name] = {
                "basicAuth": {
                    "users": service.basic_auth_users,
                }
            }
            router_middlewares.append(basic_auth_name)

        for template in templates:
            middlewares[template.shared_name] = {
                template.type: template.config,
            }
            router_middlewares.append(template.shared_name)

        if service.uses_token_auth:
            middlewares[token_auth_middleware_name] = {
                "forwardAuth": {
                    "address": settings.TOKEN_AUTH_FORWARD_AUTH_URL,
                    "trustForwardHeader": True,
                    "authResponseHeaders": ["X-Auth-User", "X-Auth-Role"],
                }
            }
            router_middlewares.append(token_auth_middleware_name)
        elif service.uses_authentik:
            router_middlewares.append(self.AUTHENTIK_MIDDLEWARE)

        routers: dict[str, dict] = {}

        secure_router = {
            "rule": f"Host(`{service.domain}`)",
            "service": router_name,
        }

        if service.tls_enabled:
            secure_router["entryPoints"] = ["websecure"]
            secure_router["tls"] = self._build_tls_config()
        else:
            secure_router["entryPoints"] = ["web"]

        if router_middlewares:
            secure_router["middlewares"] = router_middlewares

        routers[router_name] = secure_router

        if service.blocked_paths:
            block_middleware_name = f"{router_name}-block"
            middlewares[block_middleware_name] = {
                "ipAllowList": {
                    "sourceRange": ["255.255.255.255/32"],
                }
            }
            for i, path in enumerate(service.blocked_paths):
                block_router_name = f"{router_name}-block-{i}"
                routers[block_router_name] = {
                    "rule": f"Host(`{service.domain}`) && PathPrefix(`{path}`)",
                    "service": router_name,
                    "priority": 200,
                    "middlewares": [block_middleware_name],
                }
                if service.tls_enabled:
                    routers[block_router_name]["entryPoints"] = ["websecure"]
                    routers[block_router_name]["tls"] = self._build_tls_config()
                else:
                    routers[block_router_name]["entryPoints"] = ["web"]

        if service.tls_enabled and service.https_redirect_enabled:
            middlewares[redirect_middleware_name] = {
                "redirectScheme": {
                    "scheme": "https",
                    "permanent": True,
                }
            }

            redirect_middlewares = [redirect_middleware_name]
            if service.allowed_ips:
                redirect_middlewares.insert(0, ip_allowlist_name)

            routers[f"{router_name}-redirect"] = {
                "rule": f"Host(`{service.domain}`)",
                "service": router_name,
                "entryPoints": ["web"],
                "middlewares": redirect_middlewares,
            }

        if service.uses_authentik:
            outpost_router_name = f"{router_name}-authentik-outpost"
            outpost_router: dict = {
                "rule": f"Host(`{service.domain}`) && PathPrefix(`{self.AUTHENTIK_OUTPOST_PATH_PREFIX}`)",
                "service": self.AUTHENTIK_OUTPOST_SERVICE,
                "priority": 999,
            }
            if service.tls_enabled:
                outpost_router["entryPoints"] = ["websecure"]
                outpost_router["tls"] = self._build_tls_config()
            else:
                outpost_router["entryPoints"] = ["web"]
            routers[outpost_router_name] = outpost_router

        traefik_service: dict = {
            "loadBalancer": {
                "servers": [{"url": upstream_url}]
            }
        }

        config: dict = {
            "http": {
                "routers": routers,
                "services": {
                    router_name: traefik_service
                },
            }
        }

        if service.upstream_scheme == "https" and service.skip_tls_verify:
            transport_name = f"{router_name}-transport"
            config["http"]["serversTransports"] = {
                transport_name: {"insecureSkipVerify": True}
            }
            traefik_service["loadBalancer"]["serversTransport"] = transport_name

        if middlewares:
            config["http"]["middlewares"] = middlewares

        return config

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
        router_base_name = f"redirect-{self._to_safe_name(str(redirect_host.domain))}"
        host_redirect_middleware = f"{router_base_name}-host-redirect"
        force_https_middleware = f"{router_base_name}-force-https"

        escaped_domain = re.escape(str(redirect_host.domain))
        replacement = self._build_redirect_replacement(redirect_host.target_url)

        middlewares: dict = {
            host_redirect_middleware: {
                "redirectRegex": {
                    "regex": f"^https?://{escaped_domain}(.*)",
                    "replacement": replacement,
                    "permanent": redirect_host.permanent,
                }
            }
        }

        routers: dict[str, dict] = {}

        if redirect_host.tls_enabled:
            middlewares[force_https_middleware] = {
                "redirectScheme": {
                    "scheme": "https",
                    "permanent": redirect_host.permanent,
                }
            }
            routers[f"{router_base_name}-web"] = {
                "rule": f"Host(`{redirect_host.domain}`)",
                "entryPoints": ["web"],
                "middlewares": [force_https_middleware],
                "service": "noop@internal",
            }
            routers[f"{router_base_name}-websecure"] = {
                "rule": f"Host(`{redirect_host.domain}`)",
                "entryPoints": ["websecure"],
                "tls": self._build_tls_config(),
                "middlewares": [host_redirect_middleware],
                "service": "noop@internal",
            }
        else:
            routers[f"{router_base_name}-web"] = {
                "rule": f"Host(`{redirect_host.domain}`)",
                "entryPoints": ["web"],
                "middlewares": [host_redirect_middleware],
                "service": "noop@internal",
            }

        return {
            "http": {
                "routers": routers,
                "middlewares": middlewares,
            }
        }

    @staticmethod
    def _build_frame_policy_headers(frame_policy: str) -> dict:
        if frame_policy == "deny":
            return {"frameDeny": True}
        if frame_policy == "sameorigin":
            return {"customFrameOptionsValue": "SAMEORIGIN"}
        raise ValueError(f"지원하지 않는 frame_policy입니다: {frame_policy}")

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
