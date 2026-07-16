from datetime import datetime, timezone
from ipaddress import ip_address
from uuid import UUID

from fastapi import HTTPException, status

from app.application.proxy.service_use_cases import ServiceUseCases
from app.core.config import settings
from app.infrastructure.docker.client import DockerClientError
from app.interfaces.api.v1.schemas.service_schemas import (
    ServiceGatewayDiagnosisResponse,
    ServiceGatewayNetworkConnectResponse,
)


SERVICE_DOCKER_NETWORK_CONNECT_EVENT = "service_docker_network_connect"
SERVICE_GATEWAY_DIAGNOSIS_EVENT = "service_gateway_diagnosis"


async def diagnose_service_gateway_action(
    *,
    service_id: UUID,
    use_cases: ServiceUseCases,
    upstream_checker,
    traefik_client,
    docker_client,
) -> ServiceGatewayDiagnosisResponse:
    service = await use_cases.get_service(service_id)
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="서비스를 찾을 수 없습니다")

    checks = [
        await _check_traefik_router(service, traefik_client),
        await _check_upstream(service, upstream_checker),
        await _check_docker_network(service, docker_client),
    ]
    status_value = _summarize_status(checks)
    return ServiceGatewayDiagnosisResponse(
        service_id=service.id.value if hasattr(service.id, "value") else service.id,
        domain=str(service.domain),
        status=status_value,
        summary=_build_summary(status_value),
        checked_at=datetime.now(timezone.utc),
        checks=checks,
    )


async def record_service_gateway_diagnosis_action(
    *,
    service_id: UUID,
    use_cases: ServiceUseCases,
    upstream_checker,
    traefik_client,
    docker_client,
    db,
    current_user: dict,
    audit_service,
) -> ServiceGatewayDiagnosisResponse:
    result = await diagnose_service_gateway_action(
        service_id=service_id,
        use_cases=use_cases,
        upstream_checker=upstream_checker,
        traefik_client=traefik_client,
        docker_client=docker_client,
    )
    await audit_service.record(
        db=db,
        actor=current_user["username"],
        action="test",
        resource_type="service",
        resource_id=str(service_id),
        resource_name=result.domain,
        detail={
            "event": SERVICE_GATEWAY_DIAGNOSIS_EVENT,
            "domain": result.domain,
            "status": result.status,
            "summary": result.summary,
            "checked_at": result.checked_at.isoformat(),
            "checks": [check.model_dump() for check in result.checks],
        },
    )
    return result


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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="서비스를 찾을 수 없습니다")

    if not _looks_like_container_name(service.upstream_host):
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
    upstream_container = _find_container_by_name(containers, service.upstream_host)
    if not upstream_container:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"업스트림 컨테이너 '{service.upstream_host}'를 찾지 못했습니다",
        )

    traefik_container = _find_container_by_name(containers, settings.TRAEFIK_DOCKER_CONTAINER_NAME)
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
            upstream_networks=connect_result.get("networks") or [*upstream_networks, network_name],
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


async def _check_traefik_router(service, traefik_client) -> dict:
    status_payload = await traefik_client.get_router_status()
    if not status_payload.get("connected"):
        return {
            "key": "traefik_router",
            "label": "Traefik 라우터",
            "status": "warning",
            "message": status_payload.get("message") or "Traefik 라우터 상태를 확인하지 못했습니다.",
            "details": {"connected": False},
        }

    domain = str(service.domain)
    domain_state = (status_payload.get("domains") or {}).get(domain)
    if not domain_state:
        return {
            "key": "traefik_router",
            "label": "Traefik 라우터",
            "status": "fail",
            "message": f"{domain} 도메인의 활성 Traefik 라우터를 찾지 못했습니다.",
            "details": {"domain": domain, "routers": []},
        }

    routers = domain_state.get("routers") or []
    if not domain_state.get("active"):
        return {
            "key": "traefik_router",
            "label": "Traefik 라우터",
            "status": "fail",
            "message": "Traefik 라우터가 비활성 또는 오류 상태입니다.",
            "details": {"domain": domain, "routers": routers},
        }

    return {
        "key": "traefik_router",
        "label": "Traefik 라우터",
        "status": "ok",
        "message": "도메인 라우터가 Traefik 런타임에 활성 상태로 등록되어 있습니다.",
        "details": {"domain": domain, "routers": routers},
    }


async def _check_upstream(service, upstream_checker) -> dict:
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
    status_value = result.get("status")
    if status_value == "up":
        return {
            "key": "upstream_http",
            "label": "업스트림 응답",
            "status": "ok",
            "message": f"업스트림이 HTTP {result.get('status_code')} 응답을 반환했습니다.",
            "details": result,
        }

    if status_value == "unknown":
        return {
            "key": "upstream_http",
            "label": "업스트림 응답",
            "status": "warning",
            "message": result.get("error") or "업스트림 헬스 체크가 비활성화되어 있습니다.",
            "details": result,
        }

    return {
        "key": "upstream_http",
        "label": "업스트림 응답",
        "status": "fail",
        "message": result.get("error") or "업스트림에 연결하지 못했습니다.",
        "details": result,
    }


async def _check_docker_network(service, docker_client) -> dict:
    if not docker_client.enabled:
        return {
            "key": "docker_network",
            "label": "Docker 네트워크",
            "status": "warning",
            "message": "Docker API 연결 경로가 없어 컨테이너 네트워크를 확인하지 못했습니다.",
            "details": {"enabled": False},
        }

    try:
        payload = await docker_client.list_container_candidates()
    except DockerClientError:
        return {
            "key": "docker_network",
            "label": "Docker 네트워크",
            "status": "warning",
            "message": "Docker 컨테이너 목록을 가져오지 못했습니다.",
            "details": {"enabled": True},
        }

    containers = payload.get("containers") or []
    upstream_container = _find_container_by_name(containers, service.upstream_host)
    if not upstream_container:
        status_value = "fail" if _looks_like_container_name(service.upstream_host) else "warning"
        return {
            "key": "docker_network",
            "label": "Docker 네트워크",
            "status": status_value,
            "message": f"업스트림 호스트 '{service.upstream_host}'와 일치하는 실행 중 컨테이너를 찾지 못했습니다.",
            "details": {"upstream_host": service.upstream_host},
        }

    traefik_container = _find_container_by_name(containers, settings.TRAEFIK_DOCKER_CONTAINER_NAME)
    if not traefik_container:
        return {
            "key": "docker_network",
            "label": "Docker 네트워크",
            "status": "warning",
            "message": "Traefik 컨테이너를 찾지 못해 공통 네트워크를 확인하지 못했습니다.",
            "details": {"upstream_networks": upstream_container.get("networks") or []},
        }

    upstream_networks = set(upstream_container.get("networks") or [])
    traefik_networks = set(traefik_container.get("networks") or [])
    shared_networks = sorted(upstream_networks & traefik_networks)
    target_network = settings.TRAEFIK_DOCKER_NETWORK.strip() or "proxy_net"
    if not shared_networks:
        return {
            "key": "docker_network",
            "label": "Docker 네트워크",
            "status": "fail",
            "message": "Traefik과 업스트림 컨테이너가 같은 Docker 네트워크에 없습니다.",
            "details": {
                "upstream_networks": sorted(upstream_networks),
                "traefik_networks": sorted(traefik_networks),
                "target_network": target_network,
            },
        }

    return {
        "key": "docker_network",
        "label": "Docker 네트워크",
        "status": "ok",
        "message": f"Traefik과 업스트림이 공통 네트워크에 연결되어 있습니다: {', '.join(shared_networks)}",
        "details": {
            "shared_networks": shared_networks,
            "upstream_networks": sorted(upstream_networks),
            "traefik_networks": sorted(traefik_networks),
            "target_network": target_network,
        },
    }


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


def _find_container_by_name(containers: list[dict], name: str) -> dict | None:
    target = name.strip().lstrip("/")
    for container in containers:
        container_name = str(container.get("name") or "").strip().lstrip("/")
        if container_name == target:
            return container
    return None


def _looks_like_container_name(value: str) -> bool:
    text = value.strip().lower()
    if text in {"localhost", "127.0.0.1", "::1"}:
        return False
    try:
        ip_address(text)
        return False
    except ValueError:
        return "." not in text


def _summarize_status(checks: list[dict]) -> str:
    statuses = {check["status"] for check in checks}
    if "fail" in statuses:
        return "fail"
    if "warning" in statuses:
        return "warning"
    return "ok"


def _build_summary(status_value: str) -> str:
    if status_value == "fail":
        return "Bad Gateway 가능성이 높은 항목이 있습니다."
    if status_value == "warning":
        return "라우팅은 가능하지만 추가 확인이 필요한 항목이 있습니다."
    return "Traefik 라우터, 업스트림 응답, Docker 네트워크가 정상입니다."
