import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

REQUEST_FILENAME = "traefik-update-request.json"
PATCH_UPDATE_OPERATION = "traefik_patch_update"
ALERT_RETRY_OPERATION = "traefik_rollback_alert_retry"
VERSION_PATTERN = re.compile(r"^v(\d+)\.(\d+)\.(\d+)$")
MAX_REQUEST_BYTES = 4096
MAX_HISTORY_LINES = 200


class UpdateRejectedError(RuntimeError):
    pass


class ValidationError(RuntimeError):
    def __init__(self, message: str, validations: list[dict[str, str]]):
        super().__init__(message)
        self.validations = validations


@dataclass(frozen=True)
class RunnerConfig:
    state_dir: Path
    request_dir: Path
    compose_dir: Path
    compose_file: Path
    acme_file: Path
    service: str
    container: str
    network: str
    manager_health_url: str
    docker_bin: str
    curl_bin: str

    @classmethod
    def from_environment(cls) -> "RunnerConfig":
        home = Path.home()
        state_dir = Path(
            os.environ.get(
                "TM_MANAGER_DEPLOY_STATE_DIR",
                os.environ.get("XDG_STATE_HOME", str(home / ".local/state"))
                + "/traefik-manager",
            )
        ).resolve()
        compose_dir = Path(
            os.environ.get(
                "TM_TRAEFIK_UPDATE_COMPOSE_DIR",
                str(home / "docker/traefik"),
            )
        ).resolve()
        compose_filename = os.environ.get(
            "TM_TRAEFIK_UPDATE_COMPOSE_FILE",
            "docker-compose.yml",
        )
        acme_filename = os.environ.get(
            "TM_TRAEFIK_UPDATE_ACME_FILE",
            "letsencrypt/acme.json",
        )
        _validate_relative_path(compose_filename, "Compose 파일")
        _validate_relative_path(acme_filename, "ACME 파일")
        return cls(
            state_dir=state_dir,
            request_dir=Path(
                os.environ.get(
                    "TM_TRAEFIK_UPDATE_REQUEST_DIR",
                    str(state_dir / "traefik-update-requests"),
                )
            ).resolve(),
            compose_dir=compose_dir,
            compose_file=(compose_dir / compose_filename).resolve(),
            acme_file=(compose_dir / acme_filename).resolve(),
            service=_validated_name(
                os.environ.get("TM_TRAEFIK_UPDATE_SERVICE", "traefik"),
                "Compose 서비스",
            ),
            container=_validated_name(
                os.environ.get("TM_TRAEFIK_UPDATE_CONTAINER", "traefik"),
                "컨테이너",
            ),
            network=_validated_name(
                os.environ.get("TM_TRAEFIK_UPDATE_NETWORK", "proxy_net"),
                "Docker 네트워크",
            ),
            manager_health_url=os.environ.get(
                "TM_TRAEFIK_MANAGER_HEALTH_URL",
                "",
            ).strip(),
            docker_bin=os.environ.get("TM_TRAEFIK_UPDATE_DOCKER_BIN", "docker"),
            curl_bin=os.environ.get("TM_TRAEFIK_UPDATE_CURL_BIN", "curl"),
        )

    @property
    def request_path(self) -> Path:
        return self.request_dir / REQUEST_FILENAME

    @property
    def history_path(self) -> Path:
        return self.state_dir / "traefik-updates.jsonl"

    @property
    def heartbeat_path(self) -> Path:
        return self.state_dir / "traefik-update-runner.json"


@dataclass(frozen=True)
class UpdateRequest:
    request_id: str
    target_version: str
    actor: str
    requested_at: str
    operation: str = PATCH_UPDATE_OPERATION
    source_request_id: str | None = None


@dataclass(frozen=True)
class Preflight:
    current_image: str
    current_version: str
    target_image: str


def version_from_image(image: str) -> str:
    if ":" not in image:
        raise UpdateRejectedError("현재 Traefik 이미지 버전을 확인할 수 없습니다")
    version = image.rsplit(":", 1)[1]
    if not VERSION_PATTERN.fullmatch(version):
        raise UpdateRejectedError("현재 Traefik 이미지가 고정된 버전 태그가 아닙니다")
    return version


def is_forward_patch(current: str, target: str) -> bool:
    current_match = VERSION_PATTERN.fullmatch(current)
    target_match = VERSION_PATTERN.fullmatch(target)
    if not current_match or not target_match:
        return False
    current_parts = tuple(map(int, current_match.groups()))
    target_parts = tuple(map(int, target_match.groups()))
    return current_parts[:2] == target_parts[:2] and target_parts[2] > current_parts[2]


def parse_datetime(value: str) -> datetime | None:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else None


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def message(value: object) -> str:
    return " ".join(str(value).split())[:300]


def _validated_name(value: str, label: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9_.-]{1,100}", value):
        raise ValueError(f"{label} 이름이 올바르지 않습니다")
    return value


def _validate_relative_path(value: str, label: str) -> None:
    path = Path(value)
    if path.is_absolute() or ".." in path.parts:
        raise ValueError(f"{label} 경로는 Compose 디렉터리 내부여야 합니다")
