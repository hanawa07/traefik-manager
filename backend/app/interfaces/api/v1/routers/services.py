from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.audit import audit_service
from app.application.proxy.service_use_cases import ServiceUseCases
from app.infrastructure.authentik.client import AuthentikClient
from app.infrastructure.cloudflare.client import CloudflareClient
from app.infrastructure.docker.client import DockerClient
from app.infrastructure.health import upstream_checker
from app.infrastructure.network import UpstreamDnsGuard
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.repositories.sqlite_middleware_template_repository import (
    SQLiteMiddlewareTemplateRepository,
)
from app.infrastructure.persistence.repositories.sqlite_service_repository import SQLiteServiceRepository
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import SQLiteSystemSettingsRepository
from app.infrastructure.traefik.file_provider_writer import FileProviderWriter
from app.infrastructure.traefik.traefik_api_client import TraefikApiClient
from app.interfaces.api.dependencies import get_current_user, require_write_access
from app.interfaces.api.v1.routers.services_actions import (
    create_service_action,
    delete_service_action,
    get_service_action,
    list_authentik_groups_action,
    update_service_action,
)
from app.interfaces.api.v1.routers.services_health_actions import (
    get_service_health_action,
    list_services_health_action,
)
from app.interfaces.api.v1.routers.services_gateway_diagnostics import (
    connect_service_gateway_network_action,
    diagnose_service_gateway_action,
    record_service_gateway_diagnosis_action,
)
from app.interfaces.api.v1.routers.services_rollback_action import rollback_service_change_action
from app.interfaces.api.v1.schemas.service_schemas import (
    AuthentikGroupResponse,
    ServiceCreate,
    ServiceGatewayDiagnosisResponse,
    ServiceGatewayNetworkConnectResponse,
    ServiceResponse,
    ServiceUpdate,
    UpstreamHealthResponse,
)

router = APIRouter()


async def get_use_cases(db: AsyncSession = Depends(get_db)) -> ServiceUseCases:
    settings_repository = SQLiteSystemSettingsRepository(db)
    db_settings = await settings_repository.get_all_dict()
    return ServiceUseCases(
        repository=SQLiteServiceRepository(db),
        middleware_template_repository=SQLiteMiddlewareTemplateRepository(db),
        file_writer=FileProviderWriter(),
        authentik_client=AuthentikClient(),
        cloudflare_client=CloudflareClient.from_db_settings(db_settings),
        upstream_guard=UpstreamDnsGuard(settings_repository),
    )


def get_traefik_client() -> TraefikApiClient:
    return TraefikApiClient()


def get_docker_client() -> DockerClient:
    return DockerClient()


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
    return await list_authentik_groups_action(use_cases)


@router.post("", response_model=ServiceResponse, status_code=status.HTTP_201_CREATED, summary="서비스 추가")
async def create_service(
    data: ServiceCreate,
    use_cases: ServiceUseCases = Depends(get_use_cases),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_write_access),
):
    return await create_service_action(
        data=data,
        use_cases=use_cases,
        db=db,
        current_user=current_user,
        audit_service=audit_service,
    )


@router.get("/health/all", response_model=dict[str, UpstreamHealthResponse], summary="전체 서비스 업스트림 헬스 체크")
async def list_services_health(
    use_cases: ServiceUseCases = Depends(get_use_cases),
    _: dict = Depends(get_current_user),
):
    return await list_services_health_action(use_cases=use_cases, upstream_checker=upstream_checker)


@router.get("/{service_id}/health", response_model=UpstreamHealthResponse, summary="개별 서비스 업스트림 헬스 체크")
async def get_service_health(
    service_id: UUID,
    use_cases: ServiceUseCases = Depends(get_use_cases),
    _: dict = Depends(get_current_user),
):
    return await get_service_health_action(
        service_id=service_id,
        use_cases=use_cases,
        upstream_checker=upstream_checker,
    )


@router.get(
    "/{service_id}/diagnostics/gateway",
    response_model=ServiceGatewayDiagnosisResponse,
    summary="서비스 Bad Gateway 진단",
)
async def diagnose_service_gateway(
    service_id: UUID,
    use_cases: ServiceUseCases = Depends(get_use_cases),
    traefik_client: TraefikApiClient = Depends(get_traefik_client),
    docker_client: DockerClient = Depends(get_docker_client),
    _: dict = Depends(get_current_user),
):
    return await diagnose_service_gateway_action(
        service_id=service_id,
        use_cases=use_cases,
        upstream_checker=upstream_checker,
        traefik_client=traefik_client,
        docker_client=docker_client,
    )


@router.post(
    "/{service_id}/diagnostics/gateway",
    response_model=ServiceGatewayDiagnosisResponse,
    summary="서비스 Bad Gateway 진단 기록",
)
async def record_service_gateway_diagnosis(
    service_id: UUID,
    use_cases: ServiceUseCases = Depends(get_use_cases),
    traefik_client: TraefikApiClient = Depends(get_traefik_client),
    docker_client: DockerClient = Depends(get_docker_client),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return await record_service_gateway_diagnosis_action(
        service_id=service_id,
        use_cases=use_cases,
        upstream_checker=upstream_checker,
        traefik_client=traefik_client,
        docker_client=docker_client,
        db=db,
        current_user=current_user,
        audit_service=audit_service,
    )


@router.post(
    "/{service_id}/diagnostics/gateway/network/connect",
    response_model=ServiceGatewayNetworkConnectResponse,
    summary="서비스 업스트림 컨테이너를 Traefik 네트워크에 연결",
)
async def connect_service_gateway_network(
    service_id: UUID,
    use_cases: ServiceUseCases = Depends(get_use_cases),
    docker_client: DockerClient = Depends(get_docker_client),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_write_access),
):
    return await connect_service_gateway_network_action(
        service_id=service_id,
        use_cases=use_cases,
        docker_client=docker_client,
        db=db,
        current_user=current_user,
        audit_service=audit_service,
    )


@router.get("/{service_id}", response_model=ServiceResponse, summary="서비스 조회")
async def get_service(
    service_id: UUID,
    use_cases: ServiceUseCases = Depends(get_use_cases),
    _: dict = Depends(get_current_user),
):
    return await get_service_action(service_id=service_id, use_cases=use_cases)


@router.patch("/{service_id}", response_model=ServiceResponse, summary="서비스 수정")
async def update_service(
    service_id: UUID,
    data: ServiceUpdate,
    use_cases: ServiceUseCases = Depends(get_use_cases),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_write_access),
    x_bulk_operation_id: Annotated[
        UUID | None,
        Header(alias="X-Bulk-Operation-ID"),
    ] = None,
):
    return await update_service_action(
        service_id=service_id,
        data=data,
        use_cases=use_cases,
        db=db,
        current_user=current_user,
        audit_service=audit_service,
        bulk_operation_id=str(x_bulk_operation_id) if x_bulk_operation_id else None,
    )


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
    return await rollback_service_change_action(
        audit_log_id=audit_log_id,
        use_cases=use_cases,
        db=db,
        current_user=current_user,
        audit_service=audit_service,
    )


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT, summary="서비스 삭제")
async def delete_service(
    service_id: UUID,
    use_cases: ServiceUseCases = Depends(get_use_cases),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_write_access),
):
    await delete_service_action(
        service_id=service_id,
        use_cases=use_cases,
        db=db,
        current_user=current_user,
        audit_service=audit_service,
    )
