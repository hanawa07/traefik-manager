from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession


async def record_settings_update(
    *,
    audit_service: Any,
    db: AsyncSession,
    actor: str,
    event: str,
    resource_name: str,
    before: dict[str, object],
    after: dict[str, object],
    client_ip: str | None,
    rollback_payload: dict[str, object] | None = None,
) -> None:
    changed_keys = sorted([key for key in after.keys() if before.get(key) != after.get(key)])
    detail = {
        "event": event,
        "changed_keys": changed_keys,
        "before": before,
        "after": after,
        "summary": after,
        "rollback_supported": rollback_payload is not None,
        "client_ip": client_ip,
    }
    if rollback_payload is not None:
        detail["rollback_payload"] = rollback_payload
    await audit_service.record(
        db=db,
        actor=actor,
        action="update",
        resource_type="settings",
        resource_id=event,
        resource_name=resource_name,
        detail=detail,
    )


async def record_settings_rollback(
    *,
    audit_service: Any,
    db: AsyncSession,
    actor: str,
    rollback_event: str,
    source_audit_id: str,
    resource_name: str,
    before: dict[str, object],
    after: dict[str, object],
    client_ip: str | None,
) -> None:
    changed_keys = sorted([key for key in after.keys() if before.get(key) != after.get(key)])
    await audit_service.record(
        db=db,
        actor=actor,
        action="rollback",
        resource_type="settings",
        resource_id=rollback_event,
        resource_name=resource_name,
        detail={
            "event": rollback_event,
            "source_audit_id": source_audit_id,
            "changed_keys": changed_keys,
            "before": before,
            "after": after,
            "summary": after,
            "client_ip": client_ip,
        },
    )
