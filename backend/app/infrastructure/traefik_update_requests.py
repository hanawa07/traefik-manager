import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4

from app.core.config import settings

REQUEST_FILENAME = "traefik-update-request.json"
VERSION_PATTERN = re.compile(r"^v\d+\.\d+\.\d+$")
PATCH_UPDATE_OPERATION = "traefik_patch_update"
ALERT_RETRY_OPERATION = "traefik_rollback_alert_retry"


class TraefikUpdateQueueUnavailableError(RuntimeError):
    pass


class TraefikUpdateAlreadyPendingError(RuntimeError):
    pass


def queue_traefik_patch_update(
    *,
    target_version: str,
    actor: str,
    request_dir: str | Path | None = None,
    now: datetime | None = None,
) -> dict[str, object]:
    payload = {
        "schema_version": 1,
        "operation": PATCH_UPDATE_OPERATION,
        "request_id": str(uuid4()),
        "target_version": _normalize_version(target_version),
        "actor": _normalize_actor(actor),
        "requested_at": (now or datetime.now(timezone.utc))
        .isoformat()
        .replace("+00:00", "Z"),
    }
    _publish_request(payload, request_dir)
    return {
        "request_id": payload["request_id"],
        "target_version": payload["target_version"],
        "status": "queued",
        "requested_at": payload["requested_at"],
        "message": "호스트 실행기에 Traefik 패치 업데이트를 요청했습니다",
    }


def queue_traefik_alert_retry(
    *,
    source_request_id: str,
    target_version: str,
    actor: str,
    request_dir: str | Path | None = None,
    now: datetime | None = None,
) -> dict[str, object]:
    payload = {
        "schema_version": 1,
        "operation": ALERT_RETRY_OPERATION,
        "request_id": str(uuid4()),
        "source_request_id": _normalize_request_id(source_request_id),
        "target_version": _normalize_version(target_version),
        "actor": _normalize_actor(actor),
        "requested_at": (now or datetime.now(timezone.utc))
        .isoformat()
        .replace("+00:00", "Z"),
    }
    _publish_request(payload, request_dir)
    return {
        "request_id": payload["request_id"],
        "target_version": payload["target_version"],
        "status": "queued",
        "requested_at": payload["requested_at"],
        "message": "호스트 실행기에 자동 롤백 실패 알림 재시도를 요청했습니다",
    }


def _publish_request(
    payload: dict[str, object],
    request_dir: str | Path | None,
) -> None:
    directory = Path(request_dir or settings.TRAEFIK_UPDATE_REQUEST_DIR)
    if not directory.is_dir():
        raise TraefikUpdateQueueUnavailableError(
            "Traefik 호스트 업데이트 요청 디렉터리를 사용할 수 없습니다"
        )

    request_path = directory / REQUEST_FILENAME
    temporary_path = directory / f".{REQUEST_FILENAME}.{payload['request_id']}.tmp"
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    try:
        descriptor = os.open(temporary_path, flags, 0o644)
    except OSError as exc:
        raise TraefikUpdateQueueUnavailableError(
            "Traefik 호스트 업데이트 요청을 저장하지 못했습니다"
        ) from exc

    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as request_file:
            os.fchmod(request_file.fileno(), 0o644)
            json.dump(payload, request_file, ensure_ascii=False, separators=(",", ":"))
            request_file.write("\n")
            request_file.flush()
            os.fsync(request_file.fileno())
        try:
            os.link(temporary_path, request_path, follow_symlinks=False)
        except FileExistsError as exc:
            raise TraefikUpdateAlreadyPendingError(
                "이미 처리 중인 Traefik 업데이트 요청이 있습니다"
            ) from exc
        except OSError as exc:
            raise TraefikUpdateQueueUnavailableError(
                "Traefik 호스트 업데이트 요청을 게시하지 못했습니다"
            ) from exc
    finally:
        temporary_path.unlink(missing_ok=True)


def _normalize_version(value: str) -> str:
    normalized = value.strip()
    if not normalized.startswith("v"):
        normalized = f"v{normalized}"
    if not VERSION_PATTERN.fullmatch(normalized):
        raise ValueError("Traefik 대상 버전은 v3.7.8 형식이어야 합니다")
    return normalized


def _normalize_actor(value: str) -> str:
    normalized = value.strip()
    if (
        not normalized
        or len(normalized) > 100
        or any(ord(character) < 32 for character in normalized)
    ):
        raise ValueError("유효하지 않은 업데이트 요청자입니다")
    return normalized


def _normalize_request_id(value: str) -> str:
    if not isinstance(value, str):
        raise ValueError("유효하지 않은 원본 업데이트 요청 ID입니다")
    try:
        normalized = str(UUID(value))
    except ValueError as exc:
        raise ValueError("유효하지 않은 원본 업데이트 요청 ID입니다") from exc
    if normalized != value:
        raise ValueError("유효하지 않은 원본 업데이트 요청 ID입니다")
    return value
