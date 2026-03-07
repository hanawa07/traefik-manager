from pathlib import Path
import yaml
from app.core.config import settings
from app.domain.proxy.entities.middleware_template import MiddlewareTemplate
from app.domain.proxy.entities.redirect_host import RedirectHost
from app.domain.proxy.entities.service import Service
from app.infrastructure.traefik.config_generator import TraefikConfigGenerator


class FileProviderWriter:
    """Traefik File Provider 디렉토리에 YAML 파일 생성/삭제"""

    AUTHENTIK_MIDDLEWARE_FILE = "authentik-middleware.yml"
    AUTHENTIK_FORWARD_AUTH_CONFIG = {
        "http": {
            "middlewares": {
                "authentik": {
                    "forwardAuth": {
                        "address": "http://authentik-server:9000/outpost.goauthentik.io/auth/traefik",
                        "trustForwardHeader": True,
                        "authResponseHeaders": [
                            "X-authentik-username",
                            "X-authentik-groups",
                            "X-authentik-email",
                            "X-authentik-name",
                            "X-authentik-uid",
                            "X-authentik-jwt",
                            "X-authentik-meta-jwks",
                            "X-authentik-meta-outpost",
                            "X-authentik-meta-provider",
                            "X-authentik-meta-app",
                            "X-authentik-meta-version",
                        ],
                    }
                }
            },
            "services": {
                "authentik-outpost": {
                    "loadBalancer": {
                        "servers": [{"url": "http://authentik-server:9000"}]
                    }
                }
            },
        }
    }

    def __init__(self):
        self.config_path = Path(settings.TRAEFIK_CONFIG_PATH)
        self.generator = TraefikConfigGenerator()

    def write(
        self,
        service: Service,
        middleware_templates: list[MiddlewareTemplate] | None = None,
    ) -> None:
        self.config_path.mkdir(parents=True, exist_ok=True)
        file_path = self._get_service_file_path(service)
        file_path.write_text(
            self.generator.to_yaml(service, middleware_templates=middleware_templates or []),
            encoding="utf-8",
        )

    def delete(self, service: Service) -> None:
        file_path = self._get_service_file_path(service)
        if file_path.exists():
            file_path.unlink()

    def write_redirect_host(self, redirect_host: RedirectHost) -> None:
        self.config_path.mkdir(parents=True, exist_ok=True)
        file_path = self._get_redirect_file_path(redirect_host)
        file_path.write_text(
            self.generator.to_yaml_redirect_host(redirect_host),
            encoding="utf-8",
        )

    def delete_redirect_host(self, redirect_host: RedirectHost) -> None:
        self.delete_redirect_host_by_domain(str(redirect_host.domain))

    def delete_redirect_host_by_domain(self, domain: str) -> None:
        file_path = self._get_redirect_file_path_by_domain(domain)
        if file_path.exists():
            file_path.unlink()

    def _get_service_file_path(self, service: Service) -> Path:
        safe_name = str(service.domain).replace(".", "-")
        return self.config_path / f"{safe_name}.yml"

    def _get_redirect_file_path(self, redirect_host: RedirectHost) -> Path:
        return self._get_redirect_file_path_by_domain(str(redirect_host.domain))

    def _get_redirect_file_path_by_domain(self, domain: str) -> Path:
        safe_name = domain.replace(".", "-")
        return self.config_path / f"redirect-{safe_name}.yml"

    def write_authentik_middleware(self) -> None:
        """authentik ForwardAuth 미들웨어 정의 파일을 생성한다."""
        self.config_path.mkdir(parents=True, exist_ok=True)
        file_path = self.config_path / self.AUTHENTIK_MIDDLEWARE_FILE
        file_path.write_text(
            yaml.dump(
                self.AUTHENTIK_FORWARD_AUTH_CONFIG,
                default_flow_style=False,
                allow_unicode=True,
            ),
            encoding="utf-8",
        )

    def delete_authentik_middleware_if_unused(self, remaining_auth_service_count: int) -> None:
        """auth 활성화된 서비스가 없을 때만 authentik 미들웨어 파일을 삭제한다."""
        if remaining_auth_service_count > 0:
            return
        file_path = self.config_path / self.AUTHENTIK_MIDDLEWARE_FILE
        if file_path.exists():
            file_path.unlink()
