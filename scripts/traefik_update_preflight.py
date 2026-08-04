import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from traefik_update_models import (
    Preflight,
    RunnerConfig,
    UpdateRejectedError,
    is_forward_patch,
    version_from_image,
)
from traefik_update_runtime import _compose_command, _docker_inspect, _run
from traefik_update_storage import atomic_write


def _preflight(config: RunnerConfig, target_version: str) -> Preflight:
    if (
        not config.compose_files
        or any(not compose_file.is_file() for compose_file in config.compose_files)
        or not config.acme_file.is_file()
    ):
        raise UpdateRejectedError("Compose 또는 ACME 파일을 찾을 수 없습니다")
    if (
        any(config.compose_dir not in compose_file.parents for compose_file in config.compose_files)
        or config.compose_dir not in config.acme_file.parents
    ):
        raise UpdateRejectedError(
            "업데이트 대상 파일이 Traefik Compose 디렉터리 밖에 있습니다"
        )
    if config.acme_file.stat().st_size == 0:
        raise UpdateRejectedError("ACME 저장소가 비어 있습니다")

    current_image = _docker_inspect(config, "{{.Config.Image}}")
    current_version = version_from_image(current_image)
    if current_version != target_version and not is_forward_patch(
        current_version,
        target_version,
    ):
        raise UpdateRejectedError(
            "동일 메이저·마이너의 상향 패치 업데이트만 허용합니다"
        )
    repository = current_image.rsplit(":", 1)[0]
    if repository not in {
        "traefik",
        "docker.io/library/traefik",
        "registry-1.docker.io/library/traefik",
    }:
        raise UpdateRejectedError("Traefik 공식 이미지 계열만 업데이트할 수 있습니다")
    networks = json.loads(
        _docker_inspect(config, "{{json .NetworkSettings.Networks}}")
    )
    if not isinstance(networks, dict) or config.network not in networks:
        raise UpdateRejectedError(
            f"{config.network} 네트워크 연결을 확인할 수 없습니다"
        )
    services = _run(
        [
            *_compose_command(config),
            "config",
            "--services",
        ]
    ).splitlines()
    if config.service not in services:
        raise UpdateRejectedError("Traefik Compose 서비스를 확인할 수 없습니다")
    target_image = f"{repository}:{target_version}"
    image_compose_file = _find_image_compose_file(config.compose_files, current_image)
    return Preflight(
        current_image,
        current_version,
        target_image,
        image_compose_file,
    )


def _create_backup(config: RunnerConfig, request_id: str) -> Path:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    backup_dir = (
        config.compose_dir
        / "backups"
        / f"traefik-manager-{timestamp}-{request_id[:8]}"
    )
    backup_dir.mkdir(mode=0o700, parents=True, exist_ok=False)
    try:
        for compose_file in config.compose_files:
            destination = _compose_backup_path(config, backup_dir, compose_file)
            destination.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            shutil.copy2(compose_file, destination)
        shutil.copy2(config.acme_file, backup_dir / "acme.json")
    except Exception:
        shutil.rmtree(backup_dir, ignore_errors=True)
        raise
    return backup_dir


def _compose_backup_path(
    config: RunnerConfig,
    backup_dir: Path,
    compose_file: Path,
) -> Path:
    return backup_dir / "compose" / compose_file.relative_to(config.compose_dir)


def _find_image_compose_file(
    compose_files: tuple[Path, ...],
    current_image: str,
) -> Path:
    needle = f"image: {current_image}"
    matches: list[Path] = []
    occurrence_count = 0
    for compose_file in compose_files:
        count = compose_file.read_text(encoding="utf-8").count(needle)
        occurrence_count += count
        if count:
            matches.append(compose_file)
    if occurrence_count != 1:
        raise UpdateRejectedError(
            "Compose의 현재 Traefik 이미지 태그를 정확히 한 곳에서 찾지 못했습니다"
        )
    return matches[0]


def _replace_compose_image(
    path: Path,
    current_image: str,
    target_image: str,
) -> None:
    current = path.read_text(encoding="utf-8")
    needle = f"image: {current_image}"
    if current.count(needle) != 1:
        raise UpdateRejectedError(
            "Compose 이미지 태그가 사전 점검 이후 변경되었습니다"
        )
    atomic_write(
        path,
        current.replace(needle, f"image: {target_image}", 1),
        path.stat().st_mode & 0o777,
    )
