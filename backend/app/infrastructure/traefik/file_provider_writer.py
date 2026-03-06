import os
from pathlib import Path
from app.core.config import settings
from app.domain.proxy.entities.service import Service
from app.infrastructure.traefik.config_generator import TraefikConfigGenerator


class FileProviderWriter:
    """Traefik File Provider 디렉토리에 YAML 파일 생성/삭제"""

    def __init__(self):
        self.config_path = Path(settings.TRAEFIK_CONFIG_PATH)
        self.generator = TraefikConfigGenerator()

    def write(self, service: Service) -> None:
        self.config_path.mkdir(parents=True, exist_ok=True)
        file_path = self._get_file_path(service)
        file_path.write_text(self.generator.to_yaml(service), encoding="utf-8")

    def delete(self, service: Service) -> None:
        file_path = self._get_file_path(service)
        if file_path.exists():
            file_path.unlink()

    def _get_file_path(self, service: Service) -> Path:
        safe_name = str(service.domain).replace(".", "-")
        return self.config_path / f"{safe_name}.yml"
