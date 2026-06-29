from datetime import datetime, timezone

from app.infrastructure.persistence.models import AuditLogModel
from app.interfaces.api.v1.schemas.audit_schemas import AuditLogResponse


def get_event(log: AuditLogModel) -> str | None:
    detail = log.detail or {}
    event = detail.get("event")
    return event if isinstance(event, str) else None


def get_detail_int(log: AuditLogModel, key: str) -> int | None:
    detail = log.detail or {}
    value = detail.get(key)
    return value if isinstance(value, int) else None


def get_detail_str(log: AuditLogModel, key: str) -> str | None:
    detail = log.detail or {}
    value = detail.get(key)
    return value if isinstance(value, str) else None


def get_detail_bool(log: AuditLogModel, key: str) -> bool | None:
    detail = log.detail or {}
    value = detail.get(key)
    return value if isinstance(value, bool) else None


def normalize_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def to_audit_log_response(log: AuditLogModel) -> AuditLogResponse:
    return AuditLogResponse(
        id=log.id,
        actor=log.actor,
        action=log.action,
        resource_type=log.resource_type,
        resource_id=log.resource_id,
        resource_name=log.resource_name,
        detail=log.detail,
        event=get_event(log),
        created_at=normalize_utc(log.created_at),
    )
