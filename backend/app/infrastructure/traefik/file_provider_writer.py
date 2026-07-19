import os
from pathlib import Path
from tempfile import NamedTemporaryFile

import yaml
from app.core.config import settings
from app.domain.proxy.entities.middleware_template import MiddlewareTemplate
from app.domain.proxy.entities.redirect_host import RedirectHost
from app.domain.proxy.entities.service import Service
from app.infrastructure.traefik.config_generator import TraefikConfigGenerator


class FileProviderWriter:
    """Traefik File Provider 디렉토리에 YAML 파일 생성/삭제"""

    AUTHENTIK_MIDDLEWARE_FILE = "authentik-middleware.yml"
    SHARED_MIDDLEWARE_TEMPLATES_FILE = "shared-middleware-templates.yml"
    TRAEFIK_DASHBOARD_PUBLIC_FILE = "traefik-dashboard-public.yml"
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
        if service.routing_mode == "disabled":
            self.delete(service)
            return
        self.config_path.mkdir(parents=True, exist_ok=True)
        file_path = self._get_service_file_path(service)
        self._write_text_atomic(
            file_path,
            self.generator.to_yaml(service, middleware_templates=middleware_templates or []),
        )

    def delete(self, service: Service) -> None:
        file_path = self._get_service_file_path(service)
        if file_path.exists():
            file_path.unlink()

    def write_shared_middleware_templates(self, templates: list[MiddlewareTemplate]) -> None:
        self.config_path.mkdir(parents=True, exist_ok=True)
        file_path = self.config_path / self.SHARED_MIDDLEWARE_TEMPLATES_FILE
        if not templates:
            if file_path.exists():
                file_path.unlink()
            return

        self._write_text_atomic(
            file_path,
            self.generator.to_yaml_shared_middleware_templates(templates),
        )

    def write_redirect_host(self, redirect_host: RedirectHost) -> None:
        self.config_path.mkdir(parents=True, exist_ok=True)
        file_path = self._get_redirect_file_path(redirect_host)
        self._write_text_atomic(
            file_path,
            self.generator.to_yaml_redirect_host(redirect_host),
        )

    def delete_redirect_host(self, redirect_host: RedirectHost) -> None:
        self.delete_redirect_host_by_domain(str(redirect_host.domain))

    def delete_redirect_host_by_domain(self, domain: str) -> None:
        file_path = self._get_redirect_file_path_by_domain(domain)
        if file_path.exists():
            file_path.unlink()

    def write_traefik_dashboard_public_route(
        self,
        *,
        domain: str,
        basic_auth_username: str,
        basic_auth_password_hash: str,
    ) -> None:
        self.config_path.mkdir(parents=True, exist_ok=True)
        file_path = self.config_path / self.TRAEFIK_DASHBOARD_PUBLIC_FILE
        self._write_text_atomic(
            file_path,
            self.generator.to_yaml_traefik_dashboard_public_route(
                domain=domain,
                basic_auth_username=basic_auth_username,
                basic_auth_password_hash=basic_auth_password_hash,
            ),
        )

    def delete_traefik_dashboard_public_route(self) -> None:
        file_path = self.config_path / self.TRAEFIK_DASHBOARD_PUBLIC_FILE
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
        self._write_text_atomic(
            file_path,
            yaml.dump(
                self.AUTHENTIK_FORWARD_AUTH_CONFIG,
                default_flow_style=False,
                allow_unicode=True,
            ),
        )

    def delete_authentik_middleware_if_unused(self, remaining_auth_service_count: int) -> None:
        """auth 활성화된 서비스가 없을 때만 authentik 미들웨어 파일을 삭제한다."""
        if remaining_auth_service_count > 0:
            return
        file_path = self.config_path / self.AUTHENTIK_MIDDLEWARE_FILE
        if file_path.exists():
            file_path.unlink()

    def _write_text_atomic(self, file_path: Path, content: str) -> None:
        """Traefik이 부분 작성된 YAML을 읽지 않도록 같은 디렉터리에서 원자 교체한다."""
        self.config_path.mkdir(parents=True, exist_ok=True)
        tmp_path: Path | None = None
        try:
            with NamedTemporaryFile(
                "w",
                encoding="utf-8",
                dir=file_path.parent,
                prefix=f".{file_path.name}.",
                suffix=".tmp",
                delete=False,
            ) as tmp_file:
                tmp_path = Path(tmp_file.name)
                tmp_file.write(content)
                tmp_file.flush()
                os.fsync(tmp_file.fileno())
            tmp_path.replace(file_path)
        except Exception:
            if tmp_path is not None and tmp_path.exists():
                tmp_path.unlink()
            raise
