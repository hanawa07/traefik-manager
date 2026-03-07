import re

import yaml
from app.domain.proxy.entities.middleware_template import MiddlewareTemplate
from app.domain.proxy.entities.redirect_host import RedirectHost
from app.domain.proxy.entities.service import Service


class TraefikConfigGenerator:
    """서비스 도메인 객체를 Traefik 동적 설정 YAML로 변환"""

    AUTHENTIK_MIDDLEWARE = "authentik@file"
    AUTHENTIK_OUTPOST_SERVICE = "authentik-outpost@file"
    AUTHENTIK_OUTPOST_PATH_PREFIX = "/outpost.goauthentik.io/"

    def generate(
        self,
        service: Service,
        middleware_templates: list[MiddlewareTemplate] | None = None,
    ) -> dict:
        templates = middleware_templates or []
        router_name = self._to_safe_name(str(service.domain))
        upstream_url = f"http://{service.upstream}"
        ip_allowlist_name = f"{router_name}-ipallowlist"
        redirect_middleware_name = f"{router_name}-redirectscheme"
        rate_limit_name = f"{router_name}-ratelimit"
        custom_headers_name = f"{router_name}-response-headers"
        basic_auth_name = f"{router_name}-basicauth"

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

        if service.auth_enabled:
            router_middlewares.append(self.AUTHENTIK_MIDDLEWARE)

        routers: dict[str, dict] = {}

        secure_router = {
            "rule": f"Host(`{service.domain}`)",
            "service": router_name,
        }

        if service.tls_enabled:
            secure_router["entryPoints"] = ["websecure"]
            secure_router["tls"] = {}
        else:
            secure_router["entryPoints"] = ["web"]

        if router_middlewares:
            secure_router["middlewares"] = router_middlewares

        routers[router_name] = secure_router

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

        if service.auth_enabled:
            outpost_router_name = f"{router_name}-authentik-outpost"
            outpost_router: dict = {
                "rule": f"Host(`{service.domain}`) && PathPrefix(`{self.AUTHENTIK_OUTPOST_PATH_PREFIX}`)",
                "service": self.AUTHENTIK_OUTPOST_SERVICE,
                "priority": 999,
            }
            if service.tls_enabled:
                outpost_router["entryPoints"] = ["websecure"]
                outpost_router["tls"] = {}
            else:
                outpost_router["entryPoints"] = ["web"]
            routers[outpost_router_name] = outpost_router

        config = {
            "http": {
                "routers": routers,
                "services": {
                    router_name: {
                        "loadBalancer": {
                            "servers": [{"url": upstream_url}]
                        }
                    }
                },
            }
        }

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
                "tls": {},
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
