from dataclasses import dataclass
from typing import Any, Callable
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.proxy.service_use_cases import ServiceUseCases
from app.infrastructure.docker.client import DockerClient
from app.infrastructure.persistence.database import get_db
from app.infrastructure.traefik.traefik_api_client import TraefikApiClient
from app.interfaces.api.v1.routers.services_gateway_diagnostics import (
    diagnose_service_gateway_action,
    record_service_gateway_diagnosis_action,
)
from app.interfaces.api.v1.routers.services_gateway_network import (
    connect_service_gateway_network_action,
)
from app.interfaces.api.v1.schemas.service_schemas import (
    ServiceGatewayDiagnosisResponse,
    ServiceGatewayNetworkConnectResponse,
)


@dataclass(frozen=True)
class ServiceGatewayEndpoints:
    diagnose_service_gateway: Callable[..., Any]
    record_service_gateway_diagnosis: Callable[..., Any]
    connect_service_gateway_network: Callable[..., Any]


def register_service_gateway_routes(
    router: APIRouter,
    *,
    get_use_cases: Callable[..., ServiceUseCases],
    get_traefik_client: Callable[[], TraefikApiClient],
    get_docker_client: Callable[[], DockerClient],
    current_user_dependency: Callable[..., Any],
    write_access_dependency: Callable[..., Any],
    upstream_checker_provider: Callable[[], Any],
    audit_service_provider: Callable[[], Any],
) -> ServiceGatewayEndpoints:
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
        _: dict = Depends(current_user_dependency),
    ):
        return await diagnose_service_gateway_action(
            service_id=service_id,
            use_cases=use_cases,
            upstream_checker=upstream_checker_provider(),
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
        current_user: dict = Depends(current_user_dependency),
    ):
        return await record_service_gateway_diagnosis_action(
            service_id=service_id,
            use_cases=use_cases,
            upstream_checker=upstream_checker_provider(),
            traefik_client=traefik_client,
            docker_client=docker_client,
            db=db,
            current_user=current_user,
            audit_service=audit_service_provider(),
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
        current_user: dict = Depends(write_access_dependency),
    ):
        return await connect_service_gateway_network_action(
            service_id=service_id,
            use_cases=use_cases,
            docker_client=docker_client,
            db=db,
            current_user=current_user,
            audit_service=audit_service_provider(),
        )

    return ServiceGatewayEndpoints(
        diagnose_service_gateway=diagnose_service_gateway,
        record_service_gateway_diagnosis=record_service_gateway_diagnosis,
        connect_service_gateway_network=connect_service_gateway_network,
    )
