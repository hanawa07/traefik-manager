from app.domain.proxy.entities.middleware_template import MiddlewareTemplate
from app.domain.proxy.entities.service import Service
from app.infrastructure.traefik.service_middleware_builder import (
    append_service_middlewares,
    build_frame_policy_headers,
)
from app.infrastructure.traefik.service_router_builder import build_service_routers


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
    middleware_names = build_service_middleware_names(
        router_name=router_name,
        token_auth_middleware_suffix=token_auth_middleware_suffix,
    )

    middlewares: dict = {}
    router_middlewares: list[str] = []

    append_service_middlewares(
        service=service,
        middleware_templates=middleware_templates,
        middlewares=middlewares,
        router_middlewares=router_middlewares,
        names=middleware_names,
        token_auth_forward_auth_url=token_auth_forward_auth_url,
        authentik_middleware=authentik_middleware,
    )

    routers = build_service_routers(
        service=service,
        router_name=router_name,
        router_middlewares=router_middlewares,
        middlewares=middlewares,
        ip_allowlist_name=middleware_names["ip_allowlist"],
        redirect_middleware_name=middleware_names["redirect"],
        tls_config_builder=tls_config_builder,
        authentik_outpost_service=authentik_outpost_service,
        authentik_outpost_path_prefix=authentik_outpost_path_prefix,
    )

    traefik_service: dict = {"loadBalancer": {"servers": [{"url": upstream_url}]}}
    config: dict = {
        "http": {
            "routers": routers,
            "services": {
                router_name: traefik_service,
            },
        }
    }

    append_insecure_transport_if_needed(
        config=config,
        traefik_service=traefik_service,
        service=service,
        router_name=router_name,
    )

    if middlewares:
        config["http"]["middlewares"] = middlewares

    return config


def build_service_middleware_names(
    *,
    router_name: str,
    token_auth_middleware_suffix: str,
) -> dict[str, str]:
    return {
        "ip_allowlist": f"{router_name}-ipallowlist",
        "redirect": f"{router_name}-redirectscheme",
        "rate_limit": f"{router_name}-ratelimit",
        "custom_headers": f"{router_name}-response-headers",
        "frame_policy": f"{router_name}-frame-policy",
        "basic_auth": f"{router_name}-basicauth",
        "token_auth": f"{router_name}-{token_auth_middleware_suffix}",
    }


def append_insecure_transport_if_needed(
    *,
    config: dict,
    traefik_service: dict,
    service: Service,
    router_name: str,
) -> None:
    if service.upstream_scheme != "https" or not service.skip_tls_verify:
        return

    transport_name = f"{router_name}-transport"
    config["http"]["serversTransports"] = {
        transport_name: {"insecureSkipVerify": True}
    }
    traefik_service["loadBalancer"]["serversTransport"] = transport_name
