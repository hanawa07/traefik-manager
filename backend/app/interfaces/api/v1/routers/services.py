from fastapi import APIRouter, Depends, HTTPException, status
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
        upstream_checker.check_upstream(s.upstream_host, s.upstream_port)
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
    
    result = await upstream_checker.check_upstream(service.upstream_host, service.upstream_port)
    
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
        service = await use_cases.update_service(service_id, data)
        if service:
            await audit_service.record(
                db=db,
                actor=current_user["username"],
                action="update",
                resource_type="service",
                resource_id=str(service.id),
                resource_name=service.name,
                detail={"domain": str(service.domain)},
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
