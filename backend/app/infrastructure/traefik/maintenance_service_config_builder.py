from urllib.parse import quote

from app.domain.proxy.entities.service import Service
from app.infrastructure.traefik.service_router_builder import assign_entrypoint


MANAGER_FRONTEND_SERVICE = "traefik-manager-frontend-file@file"


def build_maintenance_service_config(*, service: Service, safe_name_getter, tls_config_builder) -> dict:
    router_name = safe_name_getter(str(service.domain))
    replace_path_name = f"{router_name}-maintenance-path"
    ip_allowlist_name = f"{router_name}-maintenance-ipallowlist"
    routers = {
        router_name: {
            "rule": f"Host(`{service.domain}`)",
            "service": MANAGER_FRONTEND_SERVICE,
            "middlewares": [replace_path_name],
        },
        f"{router_name}-maintenance-assets": {
            "rule": f"Host(`{service.domain}`) && PathPrefix(`/_next/`)",
            "service": MANAGER_FRONTEND_SERVICE,
            "priority": 200,
        },
    }
    assign_entrypoint(routers[router_name], service.tls_enabled, tls_config_builder)
    assign_entrypoint(
        routers[f"{router_name}-maintenance-assets"],
        service.tls_enabled,
        tls_config_builder,
    )

    middlewares = {
        replace_path_name: {
            "replacePath": {
                "path": "/maintenance",
            }
        }
    }
    if service.allowed_ips:
        middlewares[ip_allowlist_name] = {
            "ipAllowList": {"sourceRange": service.allowed_ips}
        }
        routers[router_name]["middlewares"].insert(0, ip_allowlist_name)
        routers[f"{router_name}-maintenance-assets"]["middlewares"] = [
            ip_allowlist_name
        ]
    context_headers = _build_maintenance_context_headers(service)
    if context_headers:
        context_name = f"{router_name}-maintenance-context"
        middlewares[context_name] = {
            "headers": {
                "customRequestHeaders": context_headers,
            }
        }
        routers[router_name]["middlewares"].append(context_name)
    if service.tls_enabled and service.https_redirect_enabled:
        redirect_name = f"{router_name}-maintenance-redirect"
        middlewares[redirect_name] = {
            "redirectScheme": {
                "scheme": "https",
                "permanent": True,
            }
        }
        routers[f"{router_name}-redirect"] = {
            "rule": f"Host(`{service.domain}`)",
            "service": "noop@internal",
            "entryPoints": ["web"],
            "middlewares": [redirect_name],
        }
        if service.allowed_ips:
            routers[f"{router_name}-redirect"]["middlewares"].insert(
                0,
                ip_allowlist_name,
            )

    return {
        "http": {
            "routers": routers,
            "middlewares": middlewares,
        }
    }


def _build_maintenance_context_headers(service: Service) -> dict[str, str]:
    headers: dict[str, str] = {}
    if service.maintenance_message:
        headers["X-TM-Maintenance-Message"] = quote(
            service.maintenance_message,
            safe="",
        )
    if service.maintenance_until:
        headers["X-TM-Maintenance-Until"] = service.maintenance_until.isoformat().replace(
            "+00:00",
            "Z",
        )
    return headers
