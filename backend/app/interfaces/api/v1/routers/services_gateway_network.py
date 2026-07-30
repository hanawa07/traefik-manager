from datetime import datetime, timezone
from ipaddress import ip_address
from uuid import UUID

from fastapi import HTTPException, status

from app.application.proxy.service_use_cases import ServiceUseCases
from app.core.config import settings
from app.infrastructure.docker.client import DockerClientError
from app.interfaces.api.v1.schemas.service_schemas import (
    ServiceGatewayNetworkConnectResponse,
)

SERVICE_DOCKER_NETWORK_CONNECT_EVENT = "service_docker_network_connect"


async def connect_service_gateway_network_action(
    *,
    service_id: UUID,
    use_cases: ServiceUseCases,
    docker_client,
    db,
    current_user: dict,
    audit_service,
) -> ServiceGatewayNetworkConnectResponse:
    service = await use_cases.get_service(service_id)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="서비스를 찾을 수 없습니다",
        )

    if not looks_like_container_name(service.upstream_host):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="업스트림 호스트가 컨테이너 이름이 아니어서 Docker 네트워크 연결을 실행할 수 없습니다",
        )

    if not docker_client.enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Docker API 연결 경로가 없어 네트워크 연결을 실행할 수 없습니다",
        )

    network_name = settings.TRAEFIK_DOCKER_NETWORK.strip() or "proxy_net"
    containers = await _load_container_candidates(docker_client)
    upstream_container = find_container_by_name(containers, service.upstream_host)
    if not upstream_container:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"업스트림 컨테이너 '{service.upstream_host}'를 찾지 못했습니다",
        )

    traefik_container = find_container_by_name(
        containers,
        settings.TRAEFIK_DOCKER_CONTAINER_NAME,
    )
    if not traefik_container:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Traefik 컨테이너를 찾지 못해 대상 네트워크를 검증할 수 없습니다",
        )

    traefik_networks = set(traefik_container.get("networks") or [])
    if network_name not in traefik_networks:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Traefik 컨테이너가 '{network_name}' 네트워크에 연결되어 있지 않습니다",
        )

    upstream_networks = sorted(set(upstream_container.get("networks") or []))
    if network_name in upstream_networks:
        result = _build_network_connect_response(
            service=service,
            network_name=network_name,
            status_value="already_connected",
            message=f"업스트림 컨테이너가 이미 {network_name} 네트워크에 연결되어 있습니다.",
            upstream_networks=upstream_networks,
        )
    else:
        try:
            connect_result = await docker_client.connect_container_to_network(
                container_name=service.upstream_host,
                network_name=network_name,
            )
        except DockerClientError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Docker 네트워크 연결 실행에 실패했습니다",
            ) from exc

        result = _build_network_connect_response(
            service=service,
            network_name=network_name,
            status_value="connected",
            message=f"업스트림 컨테이너를 {network_name} 네트워크에 연결했습니다.",
            upstream_networks=connect_result.get("networks")
            or [*upstream_networks, network_name],
        )

    await audit_service.record(
        db=db,
        actor=current_user["username"],
        action="update",
        resource_type="service",
        resource_id=str(service_id),
        resource_name=service.name,
        detail={
            "event": SERVICE_DOCKER_NETWORK_CONNECT_EVENT,
            "domain": str(service.domain),
            "upstream_host": service.upstream_host,
            "network": network_name,
            "status": result.status,
            "upstream_networks": result.upstream_networks,
        },
    )
    return result


def find_container_by_name(containers: list[dict], name: str) -> dict | None:
    target = name.strip().lstrip("/")
    for container in containers:
        container_name = str(container.get("name") or "").strip().lstrip("/")
        if container_name == target:
            return container
    return None


def looks_like_container_name(value: str) -> bool:
    text = value.strip().lower()
    if text in {"localhost", "127.0.0.1", "::1"}:
        return False
    try:
        ip_address(text)
        return False
    except ValueError:
        return "." not in text


async def _load_container_candidates(docker_client) -> list[dict]:
    try:
        payload = await docker_client.list_container_candidates()
    except DockerClientError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Docker 컨테이너 목록을 가져오지 못했습니다",
        ) from exc
    return payload.get("containers") or []


def _build_network_connect_response(
    *,
    service,
    network_name: str,
    status_value: str,
    message: str,
    upstream_networks: list[str],
) -> ServiceGatewayNetworkConnectResponse:
    return ServiceGatewayNetworkConnectResponse(
        service_id=service.id.value if hasattr(service.id, "value") else service.id,
        domain=str(service.domain),
        upstream_host=service.upstream_host,
        network=network_name,
        status=status_value,
        message=message,
        upstream_networks=sorted(set(upstream_networks)),
        checked_at=datetime.now(timezone.utc),
    )
