from typing import Awaitable, Callable

from sqlalchemy.ext.asyncio import AsyncSession


async def record_rollback_alert_retry_audit(
    *,
    audit_recorder: Callable[..., Awaitable[None]],
    db: AsyncSession,
    actor: str,
    queued: dict[str, object],
    source_request_id: str,
    target_version: object,
    client_ip: str,
) -> None:
    await audit_recorder(
        db=db,
        actor=actor,
        action="request",
        resource_type="traefik",
        resource_id=str(queued["request_id"]),
        resource_name="Traefik 자동 롤백 실패 알림 재시도",
        detail={
            "event": "traefik_rollback_alert_retry_requested",
            "source_request_id": source_request_id,
            "target_version": target_version,
            "client_ip": client_ip,
        },
    )


async def record_patch_update_request_audit(
    *,
    audit_recorder: Callable[..., Awaitable[None]],
    db: AsyncSession,
    actor: str,
    queued: dict[str, object],
    current_version: object,
    target_version: str,
    client_ip: str,
) -> None:
    await audit_recorder(
        db=db,
        actor=actor,
        action="request",
        resource_type="traefik",
        resource_id=str(queued["request_id"]),
        resource_name=f"Traefik {target_version} 패치 업데이트",
        detail={
            "event": "traefik_patch_update_requested",
            "current_version": current_version,
            "target_version": target_version,
            "client_ip": client_ip,
        },
    )
