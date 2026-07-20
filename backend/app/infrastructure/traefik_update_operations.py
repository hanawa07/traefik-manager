import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4

from app.core.config import settings
from app.infrastructure.github_actions_run import build_actions_run_api_url

MAX_HISTORY_BYTES = 128 * 1024
MAX_HISTORY_ENTRIES = 20
MAX_HISTORY_LINE_BYTES = 4096
RUNNER_HEARTBEAT_MAX_AGE_SECONDS = 180
REQUEST_FILENAME = "traefik-update-request.json"
VERSION_PATTERN = re.compile(r"^v\d+\.\d+\.\d+$")
HISTORY_STATUSES = {"running", "success", "rejected", "rolled_back", "rollback_failed"}
ALERT_REQUEST_STATUSES = {"not_needed", "pending", "requested", "request_failed"}
VALIDATION_STATUSES = {"ok", "fail"}
RUNNER_STATUSES = {"ready", "running", "error"}
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


def read_traefik_update_operations(
    *,
    history_path: str | Path | None = None,
    request_dir: str | Path | None = None,
    runner_status_path: str | Path | None = None,
    now: datetime | None = None,
) -> dict[str, object]:
    directory = Path(request_dir or settings.TRAEFIK_UPDATE_REQUEST_DIR)
    return {
        "runner": _read_runner_status(
            Path(runner_status_path or settings.TRAEFIK_UPDATE_RUNNER_STATUS_PATH),
            now=now or datetime.now(timezone.utc),
        ),
        "pending_request": (directory / REQUEST_FILENAME).is_file(),
        "history": read_traefik_update_history(history_path),
    }


def read_traefik_update_history(
    path: str | Path | None = None,
    *,
    limit: int = MAX_HISTORY_ENTRIES,
) -> list[dict[str, object]]:
    if limit <= 0:
        return []
    history_path = Path(path or settings.TRAEFIK_UPDATE_HISTORY_PATH)
    try:
        lines = _read_tail(history_path)
    except OSError:
        return []

    entries: list[dict[str, object]] = []
    seen_request_ids: set[str] = set()
    for line in reversed(lines):
        if not line or len(line.encode("utf-8")) > MAX_HISTORY_LINE_BYTES:
            continue
        try:
            raw = json.loads(line)
        except (json.JSONDecodeError, UnicodeDecodeError):
            continue
        entry = _normalize_history_entry(raw)
        if entry is None or entry["request_id"] in seen_request_ids:
            continue
        seen_request_ids.add(str(entry["request_id"]))
        entries.append(entry)
        if len(entries) >= limit:
            break
    return entries


def _read_runner_status(path: Path, *, now: datetime) -> dict[str, object]:
    fallback = {
        "available": False,
        "status": "unavailable",
        "checked_at": None,
        "message": "호스트 업데이트 실행기 상태를 확인할 수 없습니다",
    }
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, UnicodeDecodeError):
        return fallback
    if not isinstance(raw, dict):
        return fallback
    status = raw.get("status")
    checked_at = raw.get("checked_at")
    message = raw.get("message")
    if (
        status not in RUNNER_STATUSES
        or not isinstance(checked_at, str)
        or not isinstance(message, str)
        or len(message) > 300
    ):
        return fallback
    parsed_checked_at = _parse_datetime(checked_at)
    if parsed_checked_at is None:
        return fallback
    age_seconds = (now.astimezone(timezone.utc) - parsed_checked_at).total_seconds()
    available = status in {"ready", "running"} and -60 <= age_seconds <= RUNNER_HEARTBEAT_MAX_AGE_SECONDS
    return {
        "available": available,
        "status": status if available or status == "error" else "stale",
        "checked_at": checked_at,
        "message": message if available or status == "error" else "호스트 업데이트 실행기 응답이 오래되었습니다",
    }


def _normalize_history_entry(raw: object) -> dict[str, object] | None:
    if not isinstance(raw, dict):
        return None
    request_id = raw.get("request_id")
    actor = raw.get("actor")
    status = raw.get("status")
    from_version = raw.get("from_version")
    target_version = raw.get("target_version")
    requested_at = raw.get("requested_at")
    started_at = raw.get("started_at")
    completed_at = raw.get("completed_at")
    message = raw.get("message")
    if not _is_uuid(request_id) or status not in HISTORY_STATUSES:
        return None
    if not isinstance(actor, str) or not actor or len(actor) > 100:
        return None
    if not isinstance(from_version, str) or not VERSION_PATTERN.fullmatch(from_version):
        return None
    if not isinstance(target_version, str) or not VERSION_PATTERN.fullmatch(target_version):
        return None
    if not all(isinstance(value, str) and _parse_datetime(value) for value in (requested_at, started_at)):
        return None
    if completed_at is not None and (not isinstance(completed_at, str) or not _parse_datetime(completed_at)):
        return None
    if not isinstance(message, str) or len(message) > 500:
        return None
    backup_dir = raw.get("backup_dir")
    if backup_dir is not None and (not isinstance(backup_dir, str) or len(backup_dir) > 500):
        return None
    if type(raw.get("backup_created")) is not bool or type(raw.get("rollback_performed")) is not bool:
        return None
    validations = _normalize_validations(raw.get("validations"))
    if validations is None:
        return None
    alert_result = _normalize_alert_result(raw, status)
    if alert_result is None:
        return None
    return {
        "request_id": request_id,
        "actor": actor,
        "status": status,
        "from_version": from_version,
        "target_version": target_version,
        "requested_at": requested_at,
        "started_at": started_at,
        "completed_at": completed_at,
        "message": message,
        "backup_dir": backup_dir,
        "backup_created": raw["backup_created"],
        "rollback_performed": raw["rollback_performed"],
        **alert_result,
        "validations": validations,
    }


def _normalize_alert_result(
    raw: dict[str, object],
    update_status: object,
) -> dict[str, str | None] | None:
    default_status = "pending" if update_status == "rollback_failed" else "not_needed"
    alert_status = raw.get("alert_request_status", default_status)
    alert_run_url = raw.get("alert_run_url")
    if alert_run_url == "":
        alert_run_url = None
    if alert_status not in ALERT_REQUEST_STATUSES:
        return None
    if update_status != "rollback_failed" and alert_status != "not_needed":
        return None
    if alert_status == "requested":
        if not isinstance(alert_run_url, str) or not build_actions_run_api_url(alert_run_url):
            return None
    elif alert_run_url is not None:
        return None
    return {
        "alert_request_status": str(alert_status),
        "alert_run_url": alert_run_url,
    }


def _normalize_validations(raw: object) -> list[dict[str, str]] | None:
    if not isinstance(raw, list) or len(raw) > 10:
        return None
    normalized: list[dict[str, str]] = []
    for item in raw:
        if not isinstance(item, dict):
            return None
        key = item.get("key")
        status = item.get("status")
        message = item.get("message")
        if (
            not isinstance(key, str)
            or not re.fullmatch(r"[a-z_]{1,40}", key)
            or status not in VALIDATION_STATUSES
            or not isinstance(message, str)
            or len(message) > 300
        ):
            return None
        normalized.append({"key": key, "status": status, "message": message})
    return normalized


def _read_tail(path: Path) -> list[str]:
    with path.open("rb") as history_file:
        history_file.seek(0, 2)
        start = max(0, history_file.tell() - MAX_HISTORY_BYTES)
        history_file.seek(start)
        if start:
            history_file.readline()
        return history_file.read(MAX_HISTORY_BYTES).decode("utf-8", errors="ignore").splitlines()


def _normalize_version(value: str) -> str:
    normalized = value.strip()
    if not normalized.startswith("v"):
        normalized = f"v{normalized}"
    if not VERSION_PATTERN.fullmatch(normalized):
        raise ValueError("Traefik 대상 버전은 v3.7.8 형식이어야 합니다")
    return normalized


def _normalize_actor(value: str) -> str:
    normalized = value.strip()
    if not normalized or len(normalized) > 100 or any(ord(character) < 32 for character in normalized):
        raise ValueError("유효하지 않은 업데이트 요청자입니다")
    return normalized


def _normalize_request_id(value: str) -> str:
    if not _is_uuid(value):
        raise ValueError("유효하지 않은 원본 업데이트 요청 ID입니다")
    return value


def _is_uuid(value: object) -> bool:
    if not isinstance(value, str):
        return False
    try:
        return str(UUID(value)) == value
    except ValueError:
        return False


def _parse_datetime(value: str) -> datetime | None:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return None
    return parsed.astimezone(timezone.utc)
