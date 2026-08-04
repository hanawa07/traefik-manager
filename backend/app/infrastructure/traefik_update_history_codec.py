import re
from datetime import datetime, timezone
from uuid import UUID

from app.infrastructure.host_operation_alert_delivery import normalize_alert_delivery
from app.infrastructure.traefik_update_requests import VERSION_PATTERN

HISTORY_STATUSES = {"running", "success", "rejected", "rolled_back", "rollback_failed"}
ALERT_REQUEST_STATUSES = {"not_needed", "pending", "requested", "request_failed"}
VALIDATION_STATUSES = {"ok", "fail"}


def normalize_traefik_update_history_entry(
    raw: object,
) -> dict[str, object] | None:
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
    if not all(
        isinstance(value, str) and parse_traefik_update_datetime(value)
        for value in (requested_at, started_at)
    ):
        return None
    if completed_at is not None and (
        not isinstance(completed_at, str)
        or not parse_traefik_update_datetime(completed_at)
    ):
        return None
    if not isinstance(message, str) or len(message) > 500:
        return None
    backup_dir = raw.get("backup_dir")
    if backup_dir is not None and (
        not isinstance(backup_dir, str) or len(backup_dir) > 500
    ):
        return None
    if (
        type(raw.get("backup_created")) is not bool
        or type(raw.get("rollback_performed")) is not bool
    ):
        return None
    validations = _normalize_validations(raw.get("validations"))
    if validations is None:
        return None
    alert_result = normalize_traefik_update_alert_result(raw, status)
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


def normalize_traefik_update_alert_result(
    raw: dict[str, object],
    update_status: object,
) -> dict[str, str | None] | None:
    default_status = "pending" if update_status == "rollback_failed" else "not_needed"
    alert_status = raw.get("alert_request_status", default_status)
    alert_delivery = normalize_alert_delivery(
        raw.get("alert_channel"), raw.get("alert_run_url")
    )
    alert_retry_request_id = raw.get("alert_retry_request_id")
    alert_retry_actor = raw.get("alert_retry_actor")
    alert_retry_requested_at = raw.get("alert_retry_requested_at")
    if alert_delivery is None:
        return None
    alert_channel, alert_run_url = alert_delivery
    if alert_status not in ALERT_REQUEST_STATUSES:
        return None
    if update_status != "rollback_failed" and alert_status != "not_needed":
        return None
    if alert_status == "requested":
        if alert_channel is None:
            return None
    elif alert_channel is not None or alert_run_url is not None:
        return None
    if (alert_retry_actor is None) != (alert_retry_requested_at is None):
        return None
    if alert_retry_actor is not None and (
        alert_status not in {"requested", "request_failed"}
        or not isinstance(alert_retry_actor, str)
        or not alert_retry_actor
        or len(alert_retry_actor) > 100
        or any(ord(character) < 32 for character in alert_retry_actor)
    ):
        return None
    if alert_retry_requested_at is not None and (
        not isinstance(alert_retry_requested_at, str)
        or not parse_traefik_update_datetime(alert_retry_requested_at)
    ):
        return None
    if alert_retry_request_id is not None and (
        alert_retry_actor is None or not _is_uuid(alert_retry_request_id)
    ):
        return None
    return {
        "alert_request_status": str(alert_status),
        "alert_channel": alert_channel,
        "alert_run_url": alert_run_url,
        "alert_retry_request_id": alert_retry_request_id,
        "alert_retry_actor": alert_retry_actor,
        "alert_retry_requested_at": alert_retry_requested_at,
    }


def parse_traefik_update_datetime(value: str) -> datetime | None:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return None
    return parsed.astimezone(timezone.utc)


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


def _is_uuid(value: object) -> bool:
    if not isinstance(value, str):
        return False
    try:
        return str(UUID(value)) == value
    except ValueError:
        return False
