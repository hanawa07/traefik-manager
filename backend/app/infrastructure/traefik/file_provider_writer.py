from pathlib import Path
from app.core.config import settings
from app.domain.proxy.entities.redirect_host import RedirectHost
from app.domain.proxy.entities.service import Service
from app.infrastructure.traefik.config_generator import TraefikConfigGenerator


class FileProviderWriter:
    """Traefik File Provider 디렉토리에 YAML 파일 생성/삭제"""

    def __init__(self):
        self.config_path = Path(settings.TRAEFIK_CONFIG_PATH)
        self.generator = TraefikConfigGenerator()

    def write(self, service: Service) -> None:
        self.config_path.mkdir(parents=True, exist_ok=True)
        file_path = self._get_service_file_path(service)
        file_path.write_text(self.generator.to_yaml(service), encoding="utf-8")

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
