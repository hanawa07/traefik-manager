import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Callable
from uuid import UUID

from app.application.audit import audit_service
from app.application.proxy.service_middleware_templates import (
    ServiceMiddlewareTemplateResolver,
)
from app.infrastructure.persistence.database import AsyncSessionLocal
from app.infrastructure.persistence.repositories.sqlite_middleware_template_repository import (
    SQLiteMiddlewareTemplateRepository,
)
from app.infrastructure.persistence.repositories.sqlite_service_repository import (
    SQLiteServiceRepository,
)
from app.infrastructure.traefik.file_provider_writer import FileProviderWriter

logger = logging.getLogger(__name__)
MAINTENANCE_EXPIRY_CHECK_INTERVAL_SECONDS = 30


def _to_utc(value: datetime | None) -> datetime:
    current = value or datetime.now(timezone.utc)
    if current.tzinfo is None or current.utcoffset() is None:
        return current.replace(tzinfo=timezone.utc)
    return current.astimezone(timezone.utc)


def _is_expired(service, now: datetime) -> bool:
    maintenance_until = service.maintenance_until
    return (
        service.routing_mode == "maintenance"
        and maintenance_until is not None
        and _to_utc(maintenance_until) <= now
    )


async def transition_expired_maintenance_services_once(
    *,
    session_factory: Callable[[], Any] | None = None,
    file_writer_factory: Callable[[], Any] | None = None,
    audit_recorder=None,
    now: datetime | None = None,
) -> dict[str, Any]:
    current_time = _to_utc(now)
    session_factory = session_factory or AsyncSessionLocal
    file_writer = (file_writer_factory or FileProviderWriter)()
    audit_recorder = audit_recorder or audit_service.record

    async with session_factory() as session:
        services = await SQLiteServiceRepository(session).find_all()
        candidate_ids = [
            service.id.value
            for service in services
            if _is_expired(service, current_time)
        ]

    transitioned_names: list[str] = []
    failed_ids: list[str] = []
    for service_id in candidate_ids:
        try:
            name = await _transition_service(
                service_id=service_id,
                current_time=current_time,
                session_factory=session_factory,
                file_writer=file_writer,
                audit_recorder=audit_recorder,
            )
            if name:
                transitioned_names.append(name)
        except Exception:
            failed_ids.append(str(service_id))
            logger.warning(
                "점검 종료 자동 전환 실패: service_id=%s",
                service_id,
                exc_info=True,
            )

    return {
        "checked_at": current_time.isoformat(),
        "transitioned_count": len(transitioned_names),
        "transitioned_names": transitioned_names,
        "failed_ids": failed_ids,
    }


async def _transition_service(
    *,
    service_id: UUID,
    current_time: datetime,
    session_factory,
    file_writer,
    audit_recorder,
) -> str | None:
    async with session_factory() as session:
        service_repository = SQLiteServiceRepository(session)
        service = await service_repository.find_by_id(service_id)
        if service is None or not _is_expired(service, current_time):
            return None

        previous_until = _to_utc(service.maintenance_until).isoformat()
        before = {
            "routing_mode": service.routing_mode,
            "maintenance_until": previous_until,
        }
        service.update(routing_mode="active", clear_maintenance_until=True)
        middleware_resolver = ServiceMiddlewareTemplateResolver(
            SQLiteMiddlewareTemplateRepository(session)
        )
        templates = await middleware_resolver.resolve(service.middleware_template_ids)
        file_writer.write(service, middleware_templates=templates)
        await service_repository.save(service)

        after = {
            "routing_mode": service.routing_mode,
            "maintenance_until": None,
        }
        await audit_recorder(
            db=session,
            actor="system",
            action="update",
            resource_type="service",
            resource_id=str(service.id),
            resource_name=service.name,
            detail={
                "event": "service_update",
                "changed_keys": ["maintenance_until", "routing_mode"],
                "before": before,
                "after": after,
                "summary": after,
                "rollback_supported": True,
                "rollback_payload": {
                    "routing_mode": "maintenance",
                    "maintenance_until": None,
                },
                "automatic_transition": "maintenance_expired",
                "checked_at": current_time.isoformat(),
            },
        )
        await session.commit()
        return service.name


async def run_periodic_maintenance_expiry_check(
    *,
    interval_seconds: int,
    check_once,
) -> None:
    while True:
        await asyncio.sleep(interval_seconds)
        await check_once()
