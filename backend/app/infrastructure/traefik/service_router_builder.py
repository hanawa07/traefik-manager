from app.domain.proxy.entities.service import Service


def build_service_routers(
    *,
    service: Service,
    router_name: str,
    router_middlewares: list[str],
    middlewares: dict,
    ip_allowlist_name: str,
    redirect_middleware_name: str,
    tls_config_builder,
    authentik_outpost_service: str,
    authentik_outpost_path_prefix: str,
) -> dict[str, dict]:
    routers: dict[str, dict] = {}
    secure_router = {
        "rule": f"Host(`{service.domain}`)",
        "service": router_name,
    }

    assign_entrypoint(secure_router, service.tls_enabled, tls_config_builder)
    if router_middlewares:
        secure_router["middlewares"] = router_middlewares
    routers[router_name] = secure_router

    append_blocked_path_routers(
        routers=routers,
        middlewares=middlewares,
        service=service,
        router_name=router_name,
        tls_config_builder=tls_config_builder,
    )
    append_https_redirect_router(
        routers=routers,
        middlewares=middlewares,
        service=service,
        router_name=router_name,
        redirect_middleware_name=redirect_middleware_name,
        ip_allowlist_name=ip_allowlist_name,
    )
    append_authentik_outpost_router(
        routers=routers,
        service=service,
        router_name=router_name,
        tls_config_builder=tls_config_builder,
        authentik_outpost_service=authentik_outpost_service,
        authentik_outpost_path_prefix=authentik_outpost_path_prefix,
    )
    return routers


def append_blocked_path_routers(
    *,
    routers: dict[str, dict],
    middlewares: dict,
    service: Service,
    router_name: str,
    tls_config_builder,
) -> None:
    if not service.blocked_paths:
        return
    block_middleware_name = f"{router_name}-block"
    middlewares[block_middleware_name] = {
        "ipAllowList": {
            "sourceRange": ["255.255.255.255/32"],
        }
    }
    for index, path in enumerate(service.blocked_paths):
        block_router_name = f"{router_name}-block-{index}"
        routers[block_router_name] = {
            "rule": f"Host(`{service.domain}`) && PathPrefix(`{path}`)",
            "service": router_name,
            "priority": 200,
            "middlewares": [block_middleware_name],
        }
        assign_entrypoint(routers[block_router_name], service.tls_enabled, tls_config_builder)


def append_https_redirect_router(
    *,
    routers: dict[str, dict],
    middlewares: dict,
    service: Service,
    router_name: str,
    redirect_middleware_name: str,
    ip_allowlist_name: str,
) -> None:
    if not (service.tls_enabled and service.https_redirect_enabled):
        return
    middlewares[redirect_middleware_name] = {
        "redirectScheme": {
            "scheme": "https",
            "permanent": True,
        }
    }
    redirect_middlewares = [redirect_middleware_name]
    if service.allowed_ips:
        redirect_middlewares.insert(0, ip_allowlist_name)
    routers[f"{router_name}-redirect"] = {
        "rule": f"Host(`{service.domain}`)",
        "service": router_name,
        "entryPoints": ["web"],
        "middlewares": redirect_middlewares,
    }


def append_authentik_outpost_router(
    *,
    routers: dict[str, dict],
    service: Service,
    router_name: str,
    tls_config_builder,
    authentik_outpost_service: str,
    authentik_outpost_path_prefix: str,
) -> None:
    if not service.uses_authentik:
        return
    outpost_router_name = f"{router_name}-authentik-outpost"
    outpost_router: dict = {
        "rule": f"Host(`{service.domain}`) && PathPrefix(`{authentik_outpost_path_prefix}`)",
        "service": authentik_outpost_service,
        "priority": 999,
    }
    assign_entrypoint(outpost_router, service.tls_enabled, tls_config_builder)
    routers[outpost_router_name] = outpost_router


def assign_entrypoint(router: dict, tls_enabled: bool, tls_config_builder) -> None:
    if tls_enabled:
        router["entryPoints"] = ["websecure"]
        router["tls"] = tls_config_builder()
    else:
        router["entryPoints"] = ["web"]
