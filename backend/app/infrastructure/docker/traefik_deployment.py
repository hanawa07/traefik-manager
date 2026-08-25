from pathlib import Path
from shlex import quote
from shutil import which

from app.core.config import settings
from app.infrastructure.traefik.runtime_parsers import compare_versions


class TraefikDeploymentInspector:
    def __init__(self, docker_client):
        self.docker_client = docker_client

    async def get_status(self, *, latest_version: str | None = None) -> dict:
        if not self.docker_client.enabled:
            return {
                "enabled": False,
                "message": "Docker API 연결 경로가 없어 Traefik 배포 정보를 확인할 수 없습니다",
                "checks": [_check("docker_api", "Docker API", "fail", "Docker API를 사용할 수 없습니다.")],
                "commands": [],
                "can_apply": False,
                "apply_blocked_reason": "Docker API 연결 경로가 없습니다.",
            }

        container = await self.docker_client.get_container(settings.TRAEFIK_DOCKER_CONTAINER_NAME)
        labels = _dict_value(container.get("Config"), "Labels")
        image = _string_value(_dict_value(container.get("Config"), "Image") or container.get("Image"))
        current_version = _extract_version(labels, image)
        target_version = latest_version if latest_version and latest_version.startswith("v") else f"v{latest_version}" if latest_version else None
        target_image = _build_target_image(image, target_version)
        compose = _extract_compose_metadata(labels)
        checks = _build_checks(container=container, compose=compose, current_version=current_version, target_version=target_version)
        can_apply, blocked_reason = _resolve_apply_capability(compose)

        return {
            "enabled": True,
            "message": "Traefik 배포 정보를 확인했습니다",
            "container_name": settings.TRAEFIK_DOCKER_CONTAINER_NAME,
            "current_image": image,
            "target_image": target_image,
            "current_version": current_version,
            "target_version": target_version,
            "update_available": _is_update_available(current_version, target_version),
            "compose_project": compose["project"],
            "compose_service": compose["service"],
            "compose_working_dir": compose["working_dir"],
            "compose_config_files": compose["config_files"],
            "can_apply": can_apply,
            "apply_blocked_reason": blocked_reason,
            "checks": checks,
            "commands": _build_commands(compose=compose, current_image=image, target_image=target_image),
        }


def _extract_compose_metadata(labels: dict) -> dict:
    config_files = _string_value(labels.get("com.docker.compose.project.config_files"))
    return {
        "project": _string_value(labels.get("com.docker.compose.project")),
        "service": _string_value(labels.get("com.docker.compose.service")) or "traefik",
        "working_dir": _string_value(labels.get("com.docker.compose.project.working_dir")),
        "config_files": [item.strip() for item in (config_files or "").split(",") if item.strip()],
    }


def _build_checks(*, container: dict, compose: dict, current_version: str | None, target_version: str | None) -> list[dict]:
    checks = [
        _check("docker_api", "Docker API", "ok", "제한된 Docker API로 Traefik 컨테이너 정보를 조회했습니다."),
        _check(
            "compose_metadata",
            "Compose 메타데이터",
            "ok" if compose["working_dir"] and compose["config_files"] else "fail",
            "Compose 작업 디렉터리와 설정 파일 라벨을 확인했습니다."
            if compose["working_dir"] and compose["config_files"]
            else "Compose 라벨이 없어 안전한 적용 명령을 만들 수 없습니다.",
        ),
        _build_version_delta_check(current_version, target_version),
        _check(
            "proxy_network",
            "proxy_net 네트워크",
            "ok" if settings.TRAEFIK_DOCKER_NETWORK in _network_names(container) else "fail",
            f"Traefik 컨테이너가 {settings.TRAEFIK_DOCKER_NETWORK} 네트워크에 연결되어 있습니다."
            if settings.TRAEFIK_DOCKER_NETWORK in _network_names(container)
            else f"Traefik 컨테이너가 {settings.TRAEFIK_DOCKER_NETWORK} 네트워크에 연결되어 있지 않습니다.",
        ),
        _check(
            "acme_storage",
            "ACME 저장소",
            "ok" if _has_mount_destination(container, "/letsencrypt") else "warning",
            "인증서 저장소 마운트를 확인했습니다."
            if _has_mount_destination(container, "/letsencrypt")
            else "인증서 저장소 마운트를 확인하지 못했습니다.",
        ),
    ]
    return checks


def _build_version_delta_check(current_version: str | None, target_version: str | None) -> dict:
    comparison = compare_versions(current_version, target_version)
    if comparison == 0:
        return _check("version_delta", "버전 차이", "ok", "현재 Traefik이 최신 버전입니다.")
    if comparison is not None and comparison < 0 and is_patch_update(current_version, target_version):
        return _check("version_delta", "버전 차이", "ok", "패치 업데이트로 감지되었습니다.")
    if comparison is not None and comparison < 0:
        return _check("version_delta", "버전 차이", "warning", "패치 업데이트가 아니므로 릴리스 노트 확인이 필요합니다.")
    if comparison is not None and comparison > 0:
        return _check("version_delta", "버전 차이", "warning", "현재 버전이 감지된 최신 버전보다 높습니다.")
    return _check("version_delta", "버전 차이", "warning", "버전 차이를 해석하지 못했습니다.")


def _build_commands(*, compose: dict, current_image: str | None, target_image: str | None) -> list[dict]:
    working_dir = compose["working_dir"] or "<traefik-compose-dir>"
    service = compose["service"] or "traefik"
    config_files = compose["config_files"] or ["docker-compose.yml"]
    root = Path(working_dir)
    safe_config_files = [
        str(path.relative_to(root))
        if path.is_absolute() and path.is_relative_to(root)
        else str(path)
        for path in map(Path, config_files)
    ]
    command_prefix = f"cd {quote(working_dir)}"
    compose_command = _build_compose_command(config_files)
    service_argument = quote(service)
    safe_recreate_command = " ".join(
        [
            f"TM_TRAEFIK_UPDATE_COMPOSE_DIR={quote(working_dir)}",
            f"TM_TRAEFIK_UPDATE_COMPOSE_FILES={quote(','.join(safe_config_files))}",
            f"TM_TRAEFIK_UPDATE_SERVICE={service_argument}",
            f"TM_TRAEFIK_UPDATE_CONTAINER={quote(settings.TRAEFIK_DOCKER_CONTAINER_NAME)}",
            '"${HOME}/docker/traefik-manager/scripts/run-traefik-recreate-safely.sh"',
        ]
    )
    backup_steps = [
        'timestamp="$(date +%Y%m%d-%H%M%S)"',
        "mkdir -p backups",
        *[
            f"cp -- {quote(config_file)} {_backup_destination(config_file, index, len(config_files))}"
            for index, config_file in enumerate(config_files, start=1)
        ],
        'cp -- letsencrypt/acme.json backups/acme.json.bak."${timestamp}"',
    ]
    commands = [
        {
            "label": "백업 생성",
            "description": "Compose 파일과 acme.json을 같은 Traefik 디렉터리의 backups 아래에 보관합니다.",
            "command": " && ".join([command_prefix, *backup_steps]),
        }
    ]
    if current_image and target_image and current_image != target_image:
        config_arguments = " ".join(quote(config_file) for config_file in config_files)
        current_image_line = quote(f"image: {current_image}")
        commands.append(
            {
                "label": "이미지 태그 변경",
                "description": "현재 Traefik 이미지 태그를 목표 버전으로 교체합니다.",
                "command": (
                    f"{command_prefix} && grep -Fq -- {current_image_line} {config_arguments} && "
                    f"sed -i 's#image: {current_image}#image: {target_image}#' -- {config_arguments}"
                ),
            }
        )
    commands.extend(
        [
            {
                "label": "업데이트 적용",
                "description": "새 이미지를 받은 뒤 안전 경로에서 Traefik 서비스만 재생성합니다.",
                "command": (
                    f"{command_prefix} && {compose_command} pull {service_argument} && "
                    f"{safe_recreate_command}"
                ),
            },
            {
                "label": "상태 확인",
                "description": "Traefik API와 최근 로그를 확인합니다.",
                "command": (
                    f"{command_prefix} && {compose_command} exec -T {service_argument} "
                    f"wget -qO- http://127.0.0.1:8080/api/version && "
                    f"{compose_command} logs --tail=100 {service_argument}"
                ),
            },
        ]
    )
    return commands


def _build_compose_command(config_files: list[str]) -> str:
    config_arguments = " ".join(f"-f {quote(config_file)}" for config_file in config_files)
    return f"docker compose {config_arguments}"


def _backup_destination(config_file: str, index: int, total: int) -> str:
    filename = Path(config_file).name
    backup_name = filename if total == 1 else f"{index}-{filename}"
    return f'{quote(f"backups/{backup_name}.bak.")}"${{timestamp}}"'


def _resolve_apply_capability(compose: dict) -> tuple[bool, str | None]:
    if not compose["working_dir"] or not compose["config_files"]:
        return False, "Compose 라벨이 없어 자동 적용할 수 없습니다."
    if not which("docker"):
        return False, "매니저 백엔드 컨테이너에 Docker CLI가 없어 자동 적용할 수 없습니다."
    return True, None


def _extract_version(labels: dict, image: str | None) -> str | None:
    label_version = _string_value(labels.get("org.opencontainers.image.version"))
    if label_version:
        return label_version
    if image and ":" in image:
        return image.rsplit(":", 1)[1]
    return None


def _build_target_image(current_image: str | None, target_version: str | None) -> str | None:
    if not current_image or not target_version:
        return None
    repository = current_image.rsplit(":", 1)[0] if ":" in current_image else current_image
    return f"{repository}:{target_version}"


def _is_update_available(current_version: str | None, target_version: str | None) -> bool | None:
    comparison = compare_versions(current_version, target_version)
    return comparison < 0 if comparison is not None else None


def is_patch_update(current_version: str | None, target_version: str | None) -> bool:
    current = _version_parts(current_version)
    target = _version_parts(target_version)
    return bool(current and target and current[:2] == target[:2] and target[2] > current[2])


def _version_parts(version: str | None) -> tuple[int, int, int] | None:
    if not version:
        return None
    parts = version.lstrip("v").split(".")
    if len(parts) < 3:
        return None
    try:
        return int(parts[0]), int(parts[1]), int(parts[2])
    except ValueError:
        return None


def _network_names(container: dict) -> set[str]:
    networks = _dict_value(_dict_value(container.get("NetworkSettings"), "Networks"), None)
    return {str(name) for name in networks.keys()} if isinstance(networks, dict) else set()


def _has_mount_destination(container: dict, destination: str) -> bool:
    mounts = container.get("Mounts")
    if not isinstance(mounts, list):
        return False
    return any(isinstance(item, dict) and item.get("Destination") == destination for item in mounts)


def _check(key: str, label: str, status: str, message: str) -> dict:
    return {"key": key, "label": label, "status": status, "message": message}


def _dict_value(value, key):
    if key is None:
        return value if isinstance(value, dict) else {}
    return value.get(key) if isinstance(value, dict) else None


def _string_value(value) -> str | None:
    text = str(value).strip() if value is not None else ""
    return text or None
