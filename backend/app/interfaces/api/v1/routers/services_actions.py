import asyncio
from uuid import UUID

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.proxy.service_use_cases import ServiceUseCases
from app.infrastructure.cloudflare.client import CloudflareClientError
from app.infrastructure.persistence.models import AuditLogModel
from app.interfaces.api.v1.routers.services_audit_helpers import (
    SERVICE_CREATE_EVENT,
    SERVICE_DELETE_EVENT,
    SERVICE_ROLLBACK_EVENT,
    SERVICE_UPDATE_EVENT,
    build_service_rollback_payload,
    changed_service_keys,
    service_audit_summary,
    service_resource_id,
)
from app.interfaces.api.v1.schemas.service_schemas import ServiceCreate, ServiceUpdate, UpstreamHealthResponse


async def list_authentik_groups_action(use_cases: ServiceUseCases):
    try:
        return await use_cases.list_authentik_groups()
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Authentik 그룹 목록을 가져오지 못했습니다",
        ) from exc


async def create_service_action(
    *,
    data: ServiceCreate,
    use_cases: ServiceUseCases,
    db: AsyncSession,
    current_user: dict,
    audit_service,
):
    try:
        service = await use_cases.create_service(data)
        await audit_service.record(
            db=db,
            actor=current_user["username"],
            action="create",
            resource_type="service",
            resource_id=str(service.id),
            resource_name=service.name,
            detail={
                "event": SERVICE_CREATE_EVENT,
                "domain": str(service.domain),
            },
        )
        return service
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Authentik 연동 처리 중 오류가 발생했습니다",
        ) from exc
    except CloudflareClientError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc


async def list_services_health_action(*, use_cases: ServiceUseCases, upstream_checker) -> dict[str, UpstreamHealthResponse]:
    services = await use_cases.list_services()
    tasks = [
        upstream_checker.check_upstream(
            service.upstream_host,
            service.upstream_port,
            service.upstream_scheme,
            service.skip_tls_verify,
            service.healthcheck_enabled,
            service.healthcheck_path,
            service.healthcheck_timeout_ms,
            service.healthcheck_expected_statuses,
        )
        for service in services
    ]
    health_results = await asyncio.gather(*tasks)

    return {
        str(service.id): UpstreamHealthResponse(
            service_id=service.id.value,
            domain=str(service.domain),
            **result,
        )
        for service, result in zip(services, health_results)
    }


async def get_service_health_action(
    *,
    service_id: UUID,
    use_cases: ServiceUseCases,
    upstream_checker,
) -> UpstreamHealthResponse:
    service = await use_cases.get_service(service_id)
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="서비스를 찾을 수 없습니다")

    result = await upstream_checker.check_upstream(
        service.upstream_host,
        service.upstream_port,
        service.upstream_scheme,
        service.skip_tls_verify,
        service.healthcheck_enabled,
        service.healthcheck_path,
        service.healthcheck_timeout_ms,
        service.healthcheck_expected_statuses,
    )

    return UpstreamHealthResponse(
        service_id=service.id.value,
        domain=str(service.domain),
        **result,
    )


async def get_service_action(*, service_id: UUID, use_cases: ServiceUseCases):
    service = await use_cases.get_service(service_id)
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="서비스를 찾을 수 없습니다")
    return service


async def update_service_action(
    *,
    service_id: UUID,
    data: ServiceUpdate,
    use_cases: ServiceUseCases,
    db: AsyncSession,
    current_user: dict,
    audit_service,
):
    try:
        before_service = await use_cases.get_service(service_id)
        service = await use_cases.update_service(service_id, data)
        if service and before_service:
            before_summary = service_audit_summary(before_service)
            after_summary = service_audit_summary(service)
            rollback_payload = build_service_rollback_payload(before_service, service)
            changed_keys = changed_service_keys(before_summary, after_summary)
            await audit_service.record(
                db=db,
                actor=current_user["username"],
                action="update",
                resource_type="service",
                resource_id=service_resource_id(service),
                resource_name=service.name,
                detail={
                    "event": SERVICE_UPDATE_EVENT,
                    "changed_keys": changed_keys,
                    "before": before_summary,
                    "after": after_summary,
                    "summary": after_summary,
                    "rollback_supported": rollback_payload is not None,
                    **({"rollback_payload": rollback_payload} if rollback_payload is not None else {}),
                },
            )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Authentik 연동 처리 중 오류가 발생했습니다",
        ) from exc
    except CloudflareClientError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="서비스를 찾을 수 없습니다")
    return service


async def rollback_service_change_action(
    *,
    audit_log_id: str,
    use_cases: ServiceUseCases,
    db: AsyncSession,
    current_user: dict,
    audit_service,
):
    result = await db.execute(select(AuditLogModel).where(AuditLogModel.id == audit_log_id))
    audit_log = result.scalar_one_or_none()
    if audit_log is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="대상 서비스 변경 로그를 찾을 수 없습니다")
    if audit_log.resource_type != "service" or audit_log.action != "update":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="서비스 변경 로그만 롤백할 수 있습니다")

    detail = audit_log.detail or {}
    rollback_payload = detail.get("rollback_payload")
    if (
        detail.get("event") != SERVICE_UPDATE_EVENT
        or detail.get("rollback_supported") is not True
        or not isinstance(rollback_payload, dict)
    ):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="이 서비스 변경은 안전 롤백을 지원하지 않습니다")

    current_service = await use_cases.get_service(UUID(audit_log.resource_id))
    if current_service is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="서비스를 찾을 수 없습니다")

    before_summary = service_audit_summary(current_service)
    updated_service = await use_cases.update_service(UUID(audit_log.resource_id), ServiceUpdate(**rollback_payload))
    if updated_service is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="서비스를 찾을 수 없습니다")

    after_summary = service_audit_summary(updated_service)
    changed_keys = changed_service_keys(before_summary, after_summary)
    await audit_service.record(
        db=db,
        actor=current_user["username"],
        action="rollback",
        resource_type="service",
        resource_id=service_resource_id(updated_service),
        resource_name=updated_service.name,
        detail={
            "event": SERVICE_ROLLBACK_EVENT,
            "source_audit_id": audit_log_id,
            "changed_keys": changed_keys,
            "before": before_summary,
            "after": after_summary,
            "summary": after_summary,
        },
    )
    return updated_service


async def delete_service_action(
    *,
    service_id: UUID,
    use_cases: ServiceUseCases,
    db: AsyncSession,
    current_user: dict,
    audit_service,
) -> None:
    service = await use_cases.get_service(service_id)
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="서비스를 찾을 수 없습니다")

    try:
        await use_cases.delete_service(service_id)
        await audit_service.record(
            db=db,
            actor=current_user["username"],
            action="delete",
            resource_type="service",
            resource_id=str(service_id),
            resource_name=service.name,
            detail={
                "event": SERVICE_DELETE_EVENT,
                "domain": str(service.domain),
            },
        )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Authentik 연동 처리 중 오류가 발생했습니다",
        ) from exc
    except CloudflareClientError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
