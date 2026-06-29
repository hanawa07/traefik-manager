from app.infrastructure.traefik.runtime_parsers import (
    extract_domains_from_router,
    normalize_middlewares,
    normalize_routers,
)


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
