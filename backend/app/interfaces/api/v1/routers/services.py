from copy import deepcopy
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
import httpx

from app.interfaces.api.dependencies import get_current_user, require_write_access
from app.interfaces.api.v1.schemas.service_schemas import (
    AuthentikGroupResponse,
    ServiceCreate,
    ServiceUpdate,
    ServiceResponse,
    UpstreamHealthResponse,
)
from app.application.proxy.service_use_cases import ServiceUseCases
from app.infrastructure.health import upstream_checker
import asyncio
from app.infrastructure.cloudflare.client import CloudflareClient, CloudflareClientError
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.models import AuditLogModel
from app.infrastructure.persistence.repositories.sqlite_middleware_template_repository import (
    SQLiteMiddlewareTemplateRepository,
)
from app.infrastructure.persistence.repositories.sqlite_service_repository import SQLiteServiceRepository
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import SQLiteSystemSettingsRepository
from app.infrastructure.network import UpstreamDnsGuard
from app.infrastructure.traefik.file_provider_writer import FileProviderWriter
from app.infrastructure.authentik.client import AuthentikClient
from app.application.audit import audit_service

router = APIRouter()
SERVICE_UPDATE_EVENT = "service_update"
SERVICE_ROLLBACK_EVENT = "service_rollback"


def get_use_cases(db: AsyncSession = Depends(get_db)) -> ServiceUseCases:
    return ServiceUseCases(
        repository=SQLiteServiceRepository(db),
        middleware_template_repository=SQLiteMiddlewareTemplateRepository(db),
        file_writer=FileProviderWriter(),
        authentik_client=AuthentikClient(),
        cloudflare_client=CloudflareClient(),
        upstream_guard=UpstreamDnsGuard(SQLiteSystemSettingsRepository(db)),
    )


@router.get("", response_model=list[ServiceResponse], summary="서비스 목록")
async def list_services(
    use_cases: ServiceUseCases = Depends(get_use_cases),
    _: dict = Depends(get_current_user),
):
    return await use_cases.list_services()


@router.get("/authentik/groups", response_model=list[AuthentikGroupResponse], summary="Authentik 그룹 목록")
async def list_authentik_groups(
    use_cases: ServiceUseCases = Depends(get_use_cases),
    _: dict = Depends(get_current_user),
):
    try:
        return await use_cases.list_authentik_groups()
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Authentik 그룹 목록을 가져오지 못했습니다",
        ) from exc


@router.post("", response_model=ServiceResponse, status_code=status.HTTP_201_CREATED, summary="서비스 추가")
async def create_service(
    data: ServiceCreate,
    use_cases: ServiceUseCases = Depends(get_use_cases),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_write_access),
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
            detail={"domain": str(service.domain)},
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


@router.get("/health/all", response_model=dict[str, UpstreamHealthResponse], summary="전체 서비스 업스트림 헬스 체크")
async def list_services_health(
    use_cases: ServiceUseCases = Depends(get_use_cases),
    _: dict = Depends(get_current_user),
):
    services = await use_cases.list_services()
    
    # 병렬 헬스 체크 실행
    tasks = [
        upstream_checker.check_upstream(
            s.upstream_host,
            s.upstream_port,
            s.upstream_scheme,
            s.skip_tls_verify,
            s.healthcheck_enabled,
            s.healthcheck_path,
            s.healthcheck_timeout_ms,
            s.healthcheck_expected_statuses,
        )
        for s in services
    ]
    health_results = await asyncio.gather(*tasks)
    
    return {
        str(service.id): UpstreamHealthResponse(
            service_id=service.id.value,
            domain=str(service.domain),
            **result
        )
        for service, result in zip(services, health_results)
    }


@router.get("/{service_id}/health", response_model=UpstreamHealthResponse, summary="개별 서비스 업스트림 헬스 체크")
async def get_service_health(
    service_id: UUID,
    use_cases: ServiceUseCases = Depends(get_use_cases),
    _: dict = Depends(get_current_user),
):
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
        **result
    )


@router.get("/{service_id}", response_model=ServiceResponse, summary="서비스 조회")
async def get_service(
    service_id: UUID,
    use_cases: ServiceUseCases = Depends(get_use_cases),
    _: dict = Depends(get_current_user),
):
    service = await use_cases.get_service(service_id)
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="서비스를 찾을 수 없습니다")
    return service


@router.patch("/{service_id}", response_model=ServiceResponse, summary="서비스 수정")
async def update_service(
    service_id: UUID,
    data: ServiceUpdate,
    use_cases: ServiceUseCases = Depends(get_use_cases),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_write_access),
):
    try:
        before_service = await use_cases.get_service(service_id)
        service = await use_cases.update_service(service_id, data)
        if service and before_service:
            before_summary = _service_audit_summary(before_service)
            after_summary = _service_audit_summary(service)
            rollback_payload = _build_service_rollback_payload(before_service, service)
            changed_keys = sorted(
                [
                    key
                    for key in set(before_summary.keys()) | set(after_summary.keys())
                    if before_summary.get(key) != after_summary.get(key)
                ]
            )
            await audit_service.record(
                db=db,
                actor=current_user["username"],
                action="update",
                resource_type="service",
                resource_id=_service_resource_id(service),
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


@router.post(
    "/rollback/{audit_log_id}",
    response_model=ServiceResponse,
    summary="서비스 변경 롤백",
)
async def rollback_service_change(
    audit_log_id: str,
    use_cases: ServiceUseCases = Depends(get_use_cases),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_write_access),
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

    before_summary = _service_audit_summary(current_service)
    updated_service = await use_cases.update_service(UUID(audit_log.resource_id), ServiceUpdate(**rollback_payload))
    if updated_service is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="서비스를 찾을 수 없습니다")

    after_summary = _service_audit_summary(updated_service)
    changed_keys = sorted(
        [
            key
            for key in set(before_summary.keys()) | set(after_summary.keys())
            if before_summary.get(key) != after_summary.get(key)
        ]
    )
    await audit_service.record(
        db=db,
        actor=current_user["username"],
        action="rollback",
        resource_type="service",
        resource_id=_service_resource_id(updated_service),
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


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT, summary="서비스 삭제")
async def delete_service(
    service_id: UUID,
    use_cases: ServiceUseCases = Depends(get_use_cases),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_write_access),
):
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
            detail={"domain": str(service.domain)},
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


def _service_resource_id(service) -> str:
    service_id = getattr(service, "id", None)
    return str(getattr(service_id, "value", service_id))


def _service_audit_summary(service) -> dict[str, object]:
    return {
        "name": getattr(service, "name", ""),
        "upstream_host": getattr(service, "upstream_host", ""),
        "upstream_port": getattr(service, "upstream_port", 0),
        "upstream_scheme": getattr(service, "upstream_scheme", "http"),
        "skip_tls_verify": bool(getattr(service, "skip_tls_verify", False)),
        "tls_enabled": bool(getattr(service, "tls_enabled", True)),
        "https_redirect_enabled": bool(getattr(service, "https_redirect_enabled", True)),
        "auth_mode": getattr(service, "auth_mode", "none"),
        "api_key_configured": bool(getattr(service, "api_key", None)),
        "allowed_ips": deepcopy(getattr(service, "allowed_ips", [])),
        "blocked_paths": deepcopy(getattr(service, "blocked_paths", [])),
        "middleware_template_ids": deepcopy(getattr(service, "middleware_template_ids", [])),
        "rate_limit_enabled": bool(getattr(service, "rate_limit_enabled", False)),
        "rate_limit_average": getattr(service, "rate_limit_average", None),
        "rate_limit_burst": getattr(service, "rate_limit_burst", None),
        "custom_headers": deepcopy(getattr(service, "custom_headers", {})),
        "frame_policy": getattr(service, "frame_policy", "deny"),
        "healthcheck_enabled": bool(getattr(service, "healthcheck_enabled", True)),
        "healthcheck_path": getattr(service, "healthcheck_path", "/"),
        "healthcheck_timeout_ms": getattr(service, "healthcheck_timeout_ms", 3000),
        "healthcheck_expected_statuses": deepcopy(getattr(service, "healthcheck_expected_statuses", [])),
        "basic_auth_enabled": bool(getattr(service, "basic_auth_enabled", False)),
        "basic_auth_user_count": len(getattr(service, "basic_auth_users", [])),
        "authentik_group_id": getattr(service, "authentik_group_id", None),
    }


def _service_supports_rollback(before_service, after_service) -> bool:
    return not any(
        getattr(service, "auth_mode", "none") == "token" or bool(getattr(service, "basic_auth_users", []))
        for service in (before_service, after_service)
    )


def _build_service_rollback_payload(before_service, after_service) -> dict[str, object] | None:
    if not _service_supports_rollback(before_service, after_service):
        return None

    before_summary = _service_audit_summary(before_service)
    after_summary = _service_audit_summary(after_service)
    changed_keys = sorted(
        [
            key
            for key in set(before_summary.keys()) | set(after_summary.keys())
            if before_summary.get(key) != after_summary.get(key)
        ]
    )
    payload: dict[str, object] = {}
    copyable_keys = {
        "name",
        "upstream_host",
        "upstream_port",
        "upstream_scheme",
        "skip_tls_verify",
        "tls_enabled",
        "https_redirect_enabled",
        "auth_mode",
        "allowed_ips",
        "blocked_paths",
        "middleware_template_ids",
        "custom_headers",
        "frame_policy",
        "healthcheck_enabled",
        "healthcheck_path",
        "healthcheck_timeout_ms",
        "healthcheck_expected_statuses",
        "authentik_group_id",
    }
    for key in changed_keys:
        if key in copyable_keys:
            payload[key] = deepcopy(before_summary[key])

    if any(key in changed_keys for key in ("rate_limit_enabled", "rate_limit_average", "rate_limit_burst")):
        if before_summary["rate_limit_enabled"]:
            payload["rate_limit_enabled"] = True
            payload["rate_limit_average"] = before_summary["rate_limit_average"]
            payload["rate_limit_burst"] = before_summary["rate_limit_burst"]
        else:
            payload["rate_limit_enabled"] = False

    return payload or None
