from app.infrastructure.traefik.runtime_parsers import (
    extract_domains_from_router,
    normalize_middlewares,
    normalize_routers,
)

MANAGER_HTTPS_ROUTER = "traefik-manager-frontend-file@file"
MANAGER_HTTP_ROUTER = "traefik-manager-frontend-http-file@file"
MANAGER_SERVICE = "traefik-manager-frontend-file@file"


def build_router_status(payload: dict | list) -> dict:
    domain_states: dict[str, dict] = {}

    for router in normalize_routers(payload):
        router_name = router.get("name") or router.get("service") or "unknown"
        status_raw = str(router.get("status", "enabled")).lower()
        active = status_raw not in ("disabled", "error", "unknown")
        rule = str(router.get("rule", ""))

        for domain in extract_domains_from_router(router):
            current = domain_states.setdefault(
                domain,
                {
                    "active": False,
                    "routers": [],
                },
            )
            current["active"] = current["active"] or active
            current["routers"].append(
                {
                    "name": router_name,
                    "status": status_raw,
                    "rule": rule,
                }
            )

    return {
        "connected": True,
        "message": "Traefik 라우터 상태를 조회했습니다",
        "domains": domain_states,
    }


def build_middlewares_status(payload: dict | list) -> dict:
    middlewares = []
    for item in normalize_middlewares(payload):
        middlewares.append(
            {
                "name": str(item.get("name") or ""),
                "provider": item.get("provider"),
                "status": str(item.get("status") or "unknown"),
                "type": str(item.get("type") or "unknown"),
                "used_by": [
                    str(value)
                    for value in item.get("usedBy", [])
                    if isinstance(value, str)
                ],
                "config": {
                    key: value
                    for key, value in item.items()
                    if key not in {"name", "provider", "status", "type", "usedBy"}
                },
            }
        )

    middlewares.sort(key=lambda item: item["name"])
    return {
        "connected": True,
        "message": "Traefik 미들웨어 상태를 조회했습니다",
        "middlewares": middlewares,
    }


def build_manager_route_status(
    routers_payload: object,
    services_payload: object,
) -> dict[str, object]:
    available = isinstance(routers_payload, list) and isinstance(services_payload, list)
    https_router = _find_runtime_item(routers_payload, MANAGER_HTTPS_ROUTER)
    http_router = _find_runtime_item(routers_payload, MANAGER_HTTP_ROUTER)
    service = _find_runtime_item(services_payload, MANAGER_SERVICE)
    upstream_url, upstream_status = _read_upstream_status(service)
    active_slot = _read_manager_slot(upstream_url)
    provider = _shared_provider(https_router, http_router, service)
    https_status = _runtime_status(https_router)
    http_status = _runtime_status(http_router)
    service_status = _runtime_status(service)
    healthy = (
        available
        and active_slot is not None
        and provider == "file"
        and https_status == "enabled"
        and http_status == "enabled"
        and service_status == "enabled"
        and upstream_status == "UP"
    )

    if healthy:
        message = "Manager file-provider 라우터가 정상입니다"
    elif available:
        message = "Manager file-provider 라우터 상태를 확인하세요"
    else:
        message = "Traefik 라우터 상태를 확인하지 못했습니다"

    return {
        "available": available,
        "healthy": healthy,
        "message": message,
        "active_slot": active_slot,
        "provider": provider,
        "https_router_status": https_status,
        "http_router_status": http_status,
        "service_status": service_status,
        "upstream_url": upstream_url,
        "upstream_status": upstream_status,
    }


def _find_runtime_item(payload: object, name: str) -> dict | None:
    if not isinstance(payload, list):
        return None
    return next(
        (
            item
            for item in payload
            if isinstance(item, dict) and item.get("name") == name
        ),
        None,
    )


def _runtime_status(item: dict | None) -> str | None:
    status = item.get("status") if item else None
    return status if isinstance(status, str) else None


def _shared_provider(*items: dict | None) -> str | None:
    providers = set()
    for item in items:
        provider = item.get("provider") if item else None
        if isinstance(provider, str):
            providers.add(provider)
    if len(providers) == 1:
        return providers.pop()
    return "mixed" if providers else None


def _read_upstream_status(service: dict | None) -> tuple[str | None, str | None]:
    load_balancer = service.get("loadBalancer") if service else None
    servers = load_balancer.get("servers") if isinstance(load_balancer, dict) else None
    first_server = servers[0] if isinstance(servers, list) and servers else None
    upstream_url = first_server.get("url") if isinstance(first_server, dict) else None
    server_status = service.get("serverStatus") if service else None
    upstream_status = (
        server_status.get(upstream_url)
        if isinstance(server_status, dict) and isinstance(upstream_url, str)
        else None
    )
    return (
        upstream_url if isinstance(upstream_url, str) else None,
        upstream_status if isinstance(upstream_status, str) else None,
    )


def _read_manager_slot(upstream_url: str | None) -> str | None:
    if upstream_url == "http://traefik-manager-frontend:3000":
        return "single"
    for slot in ("blue", "green"):
        if upstream_url == f"http://traefik-manager-frontend-{slot}:3000":
            return slot
    return None
