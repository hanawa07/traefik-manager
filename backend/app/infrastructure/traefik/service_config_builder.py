from app.domain.proxy.entities.middleware_template import MiddlewareTemplate
from app.domain.proxy.entities.service import Service


def build_service_config(
    *,
    service: Service,
    middleware_templates: list[MiddlewareTemplate],
    safe_name_getter,
    tls_config_builder,
    token_auth_forward_auth_url: str,
    authentik_middleware: str,
    authentik_outpost_service: str,
    authentik_outpost_path_prefix: str,
    token_auth_middleware_suffix: str,
) -> dict:
    router_name = safe_name_getter(str(service.domain))
    upstream_url = f"{service.upstream_scheme}://{service.upstream}"
    ip_allowlist_name = f"{router_name}-ipallowlist"
    redirect_middleware_name = f"{router_name}-redirectscheme"
    rate_limit_name = f"{router_name}-ratelimit"
    custom_headers_name = f"{router_name}-response-headers"
    frame_policy_name = f"{router_name}-frame-policy"
    basic_auth_name = f"{router_name}-basicauth"
    token_auth_middleware_name = f"{router_name}-{token_auth_middleware_suffix}"

    middlewares: dict = {}
    router_middlewares: list[str] = []

    _append_service_middlewares(
        service=service,
        middleware_templates=middleware_templates,
        middlewares=middlewares,
        router_middlewares=router_middlewares,
        names={
            "ip_allowlist": ip_allowlist_name,
            "rate_limit": rate_limit_name,
            "custom_headers": custom_headers_name,
            "frame_policy": frame_policy_name,
            "basic_auth": basic_auth_name,
            "token_auth": token_auth_middleware_name,
        },
        token_auth_forward_auth_url=token_auth_forward_auth_url,
        authentik_middleware=authentik_middleware,
    )

    routers = _build_service_routers(
        service=service,
        router_name=router_name,
        router_middlewares=router_middlewares,
        middlewares=middlewares,
        ip_allowlist_name=ip_allowlist_name,
        redirect_middleware_name=redirect_middleware_name,
        tls_config_builder=tls_config_builder,
        authentik_outpost_service=authentik_outpost_service,
        authentik_outpost_path_prefix=authentik_outpost_path_prefix,
    )

    traefik_service: dict = {
        "loadBalancer": {
            "servers": [{"url": upstream_url}]
        }
    }
    config: dict = {
        "http": {
            "routers": routers,
            "services": {
                router_name: traefik_service
            },
        }
    }

    if service.upstream_scheme == "https" and service.skip_tls_verify:
        transport_name = f"{router_name}-transport"
        config["http"]["serversTransports"] = {
            transport_name: {"insecureSkipVerify": True}
        }
        traefik_service["loadBalancer"]["serversTransport"] = transport_name

    if middlewares:
        config["http"]["middlewares"] = middlewares

    return config


def _append_service_middlewares(
    *,
    service: Service,
    middleware_templates: list[MiddlewareTemplate],
    middlewares: dict,
    router_middlewares: list[str],
    names: dict[str, str],
    token_auth_forward_auth_url: str,
    authentik_middleware: str,
) -> None:
    if service.allowed_ips:
        middlewares[names["ip_allowlist"]] = {"ipAllowList": {"sourceRange": service.allowed_ips}}
        router_middlewares.append(names["ip_allowlist"])

    if service.rate_limit_enabled:
        middlewares[names["rate_limit"]] = {
            "rateLimit": {
                "average": service.rate_limit_average,
                "burst": service.rate_limit_burst,
            }
        }
        router_middlewares.append(names["rate_limit"])

    if service.custom_headers:
        middlewares[names["custom_headers"]] = {
            "headers": {
                "customResponseHeaders": service.custom_headers,
            }
        }
        router_middlewares.append(names["custom_headers"])

    if service.frame_policy != "off":
        middlewares[names["frame_policy"]] = {
            "headers": build_frame_policy_headers(service.frame_policy),
        }
        router_middlewares.append(names["frame_policy"])

    if service.basic_auth_users:
        middlewares[names["basic_auth"]] = {
            "basicAuth": {
                "users": service.basic_auth_users,
            }
        }
        router_middlewares.append(names["basic_auth"])

    for template in middleware_templates:
        middlewares[template.shared_name] = {
            template.type: template.config,
        }
        router_middlewares.append(template.shared_name)

    if service.uses_token_auth:
        middlewares[names["token_auth"]] = {
            "forwardAuth": {
                "address": token_auth_forward_auth_url,
                "trustForwardHeader": True,
                "authResponseHeaders": ["X-Auth-User", "X-Auth-Role"],
            }
        }
        router_middlewares.append(names["token_auth"])
    elif service.uses_authentik:
        router_middlewares.append(authentik_middleware)


def _build_service_routers(
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

    _assign_entrypoint(secure_router, service.tls_enabled, tls_config_builder)
    if router_middlewares:
        secure_router["middlewares"] = router_middlewares
    routers[router_name] = secure_router

    _append_blocked_path_routers(
        routers=routers,
        middlewares=middlewares,
        service=service,
        router_name=router_name,
        tls_config_builder=tls_config_builder,
    )
    _append_https_redirect_router(
        routers=routers,
        middlewares=middlewares,
        service=service,
        router_name=router_name,
        redirect_middleware_name=redirect_middleware_name,
        ip_allowlist_name=ip_allowlist_name,
    )
    _append_authentik_outpost_router(
        routers=routers,
        service=service,
        router_name=router_name,
        tls_config_builder=tls_config_builder,
        authentik_outpost_service=authentik_outpost_service,
        authentik_outpost_path_prefix=authentik_outpost_path_prefix,
    )
    return routers


def _append_blocked_path_routers(
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
        _assign_entrypoint(routers[block_router_name], service.tls_enabled, tls_config_builder)


def _append_https_redirect_router(
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


def _append_authentik_outpost_router(
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
    _assign_entrypoint(outpost_router, service.tls_enabled, tls_config_builder)
    routers[outpost_router_name] = outpost_router


def _assign_entrypoint(router: dict, tls_enabled: bool, tls_config_builder) -> None:
    if tls_enabled:
        router["entryPoints"] = ["websecure"]
        router["tls"] = tls_config_builder()
    else:
        router["entryPoints"] = ["web"]


def build_frame_policy_headers(frame_policy: str) -> dict:
    if frame_policy == "deny":
        return {"frameDeny": True}
    if frame_policy == "sameorigin":
        return {"customFrameOptionsValue": "SAMEORIGIN"}
    raise ValueError(f"지원하지 않는 frame_policy입니다: {frame_policy}")
