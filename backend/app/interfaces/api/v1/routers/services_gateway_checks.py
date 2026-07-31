from app.core.config import settings
from app.infrastructure.docker.client import DockerClientError
from app.interfaces.api.v1.routers.services_gateway_network import (
    find_container_by_name,
    looks_like_container_name,
)


async def check_traefik_router(service, traefik_client) -> dict:
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


async def check_upstream(service, upstream_checker) -> dict:
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


async def check_docker_network(service, docker_client) -> dict:
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
    upstream_container = find_container_by_name(containers, service.upstream_host)
    if not upstream_container:
        status_value = "fail" if looks_like_container_name(service.upstream_host) else "warning"
        return {
            "key": "docker_network",
            "label": "Docker 네트워크",
            "status": status_value,
            "message": f"업스트림 호스트 '{service.upstream_host}'와 일치하는 실행 중 컨테이너를 찾지 못했습니다.",
            "details": {"upstream_host": service.upstream_host},
        }

    traefik_container = find_container_by_name(
        containers,
        settings.TRAEFIK_DOCKER_CONTAINER_NAME,
    )
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
