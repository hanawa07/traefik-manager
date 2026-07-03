from datetime import datetime, timezone
from ipaddress import ip_address
from uuid import UUID

from fastapi import HTTPException, status

from app.application.proxy.service_use_cases import ServiceUseCases
from app.core.config import settings
from app.infrastructure.docker.client import DockerClientError
from app.interfaces.api.v1.schemas.service_schemas import ServiceGatewayDiagnosisResponse


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
            "message": "Docker 소켓이 없어 컨테이너 네트워크를 확인하지 못했습니다.",
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
    if not shared_networks:
        return {
            "key": "docker_network",
            "label": "Docker 네트워크",
            "status": "fail",
            "message": "Traefik과 업스트림 컨테이너가 같은 Docker 네트워크에 없습니다.",
            "details": {
                "upstream_networks": sorted(upstream_networks),
                "traefik_networks": sorted(traefik_networks),
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
        },
    }


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
