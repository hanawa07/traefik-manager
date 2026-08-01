import asyncio
from typing import Any, Awaitable, Callable, Protocol

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.traefik_update_requests import (
    TraefikUpdateAlreadyPendingError,
    TraefikUpdateQueueUnavailableError,
)
from app.interfaces.api.v1.routers.traefik_update_audit import (
    record_rollback_alert_retry_audit,
)
from app.interfaces.api.v1.routers.traefik_update_validation import (
    require_runner_available,
)

MAX_ALERT_RUN_STATUS_LOOKUPS = 5
ALERT_RUN_STATUS_FIELDS = {
    "alert_run_status": "external_watchdog_last_alert_run_status",
    "alert_run_conclusion": "external_watchdog_last_alert_run_conclusion",
    "alert_run_checked_at": "external_watchdog_last_alert_run_checked_at",
    "alert_run_error": "external_watchdog_last_alert_run_error",
}


class AlertRunStatusReader(Protocol):
    async def get_statuses(
        self,
        run_urls: list[str],
    ) -> dict[str, dict[str, object]]: ...


async def get_traefik_update_operations_action(
    *,
    operations_reader: Callable[[], dict[str, object]],
    run_status_reader: AlertRunStatusReader,
) -> dict[str, object]:
    operations = await asyncio.to_thread(operations_reader)
    history = operations.get("history")
    if not isinstance(history, list):
        return operations
    run_urls = list(
        dict.fromkeys(
            entry.get("alert_run_url")
            for entry in history
            if isinstance(entry, dict) and isinstance(entry.get("alert_run_url"), str)
        )
    )[:MAX_ALERT_RUN_STATUS_LOOKUPS]
    if not run_urls:
        return operations
    run_statuses = await run_status_reader.get_statuses(run_urls)
    operations["history"] = [
        _with_alert_run_status(entry, run_statuses) for entry in history
    ]
    return operations


async def retry_traefik_rollback_alert_action(
    *,
    request_id: str,
    db: AsyncSession,
    actor: dict[str, Any],
    client_ip_provider: Callable[[], str],
    operations_reader: Callable[[], dict[str, object]],
    queue_alert_retry: Callable[..., dict[str, object]],
    audit_recorder: Callable[..., Awaitable[None]],
) -> dict[str, object]:
    operations = await asyncio.to_thread(operations_reader)
    require_runner_available(operations)
    entry = _find_retryable_alert_entry(operations.get("history"), request_id)
    try:
        queued = await asyncio.to_thread(
            queue_alert_retry,
            source_request_id=request_id,
            target_version=str(entry["target_version"]),
            actor=actor["username"],
        )
    except TraefikUpdateAlreadyPendingError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except TraefikUpdateQueueUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    await record_rollback_alert_retry_audit(
        audit_recorder=audit_recorder,
        db=db,
        actor=actor["username"],
        queued=queued,
        source_request_id=request_id,
        target_version=entry["target_version"],
        client_ip=client_ip_provider(),
    )
    return queued


def _find_retryable_alert_entry(
    history: object,
    request_id: str,
) -> dict[str, object]:
    entry = (
        next(
            (
                item
                for item in history
                if isinstance(item, dict) and item.get("request_id") == request_id
            ),
            None,
        )
        if isinstance(history, list)
        else None
    )
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="자동 롤백 실패 이력을 찾을 수 없습니다",
        )
    if (
        entry.get("status") != "rollback_failed"
        or entry.get("alert_request_status") != "request_failed"
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="알림 요청에 실패한 자동 롤백 이력만 재시도할 수 있습니다",
        )
    return entry


def _with_alert_run_status(
    entry: object,
    run_statuses: dict[str, dict[str, object]],
) -> object:
    if not isinstance(entry, dict):
        return entry
    run_status = run_statuses.get(str(entry.get("alert_run_url")))
    if not run_status:
        return entry
    return {
        **entry,
        **{
            target: run_status.get(source)
            for target, source in ALERT_RUN_STATUS_FIELDS.items()
        },
    }
