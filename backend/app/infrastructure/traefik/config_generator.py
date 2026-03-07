import yaml
from app.domain.proxy.entities.service import Service


class TraefikConfigGenerator:
    """서비스 도메인 객체를 Traefik 동적 설정 YAML로 변환"""

    AUTHENTIK_MIDDLEWARE = "authentik@file"

    def generate(self, service: Service) -> dict:
        router_name = self._to_safe_name(str(service.domain))
        upstream_url = f"http://{service.upstream}"
        ip_allowlist_name = f"{router_name}-ipallowlist"
        redirect_middleware_name = f"{router_name}-redirectscheme"

        middlewares: dict = {}
        router_middlewares: list[str] = []

        if service.allowed_ips:
            middlewares[ip_allowlist_name] = {
                "ipAllowList": {
                    "sourceRange": service.allowed_ips,
                }
            }
            router_middlewares.append(ip_allowlist_name)

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

    def to_yaml(self, service: Service) -> str:
        return yaml.dump(
            self.generate(service),
            default_flow_style=False,
            allow_unicode=True,
        )

    def _to_safe_name(self, domain: str) -> str:
        return domain.replace(".", "-").replace("_", "-")
