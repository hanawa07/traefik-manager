import yaml
from app.domain.proxy.entities.service import Service


class TraefikConfigGenerator:
    """서비스 도메인 객체를 Traefik 동적 설정 YAML로 변환"""

    AUTHENTIK_MIDDLEWARE = "authentik@file"

    def generate(self, service: Service) -> dict:
        router_name = self._to_safe_name(str(service.domain))
        upstream_url = f"http://{service.upstream}"

        config = {
            "http": {
                "routers": {
                    router_name: {
                        "rule": f"Host(`{service.domain}`)",
                        "service": router_name,
                        "entryPoints": ["websecure" if service.tls_enabled else "web"],
                        **({"tls": {}} if service.tls_enabled else {}),
                        **({"middlewares": [self.AUTHENTIK_MIDDLEWARE]} if service.auth_enabled else {}),
                    }
                },
                "services": {
                    router_name: {
                        "loadBalancer": {
                            "servers": [{"url": upstream_url}]
                        }
                    }
                },
            }
        }
        return config

    def to_yaml(self, service: Service) -> str:
        return yaml.dump(
            self.generate(service),
            default_flow_style=False,
            allow_unicode=True,
        )

    def _to_safe_name(self, domain: str) -> str:
        return domain.replace(".", "-").replace("_", "-")
