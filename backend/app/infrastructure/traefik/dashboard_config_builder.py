def build_traefik_dashboard_public_route_config(
    *,
    domain: str,
    basic_auth_username: str,
    basic_auth_password_hash: str,
    tls_config_builder,
) -> dict:
    router_base_name = "traefik-dashboard-public"
    redirect_middleware_name = f"{router_base_name}-redirectscheme"
    basic_auth_middleware_name = f"{router_base_name}-basicauth"

    return {
        "http": {
            "routers": {
                router_base_name: {
                    "rule": f"Host(`{domain}`)",
                    "entryPoints": ["websecure"],
                    "tls": tls_config_builder(),
                    "middlewares": [basic_auth_middleware_name],
                    "service": "api@internal",
                },
                f"{router_base_name}-redirect": {
                    "rule": f"Host(`{domain}`)",
                    "entryPoints": ["web"],
                    "middlewares": [redirect_middleware_name],
                    "service": "noop@internal",
                },
            },
            "middlewares": {
                redirect_middleware_name: {
                    "redirectScheme": {
                        "scheme": "https",
                        "permanent": True,
                    }
                },
                basic_auth_middleware_name: {
                    "basicAuth": {
                        "users": [f"{basic_auth_username}:{basic_auth_password_hash}"],
                    }
                },
            },
        }
    }
