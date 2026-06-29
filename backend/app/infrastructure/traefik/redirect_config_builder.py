import re

from app.domain.proxy.entities.redirect_host import RedirectHost


def build_redirect_host_config(
    *,
    redirect_host: RedirectHost,
    safe_name_getter,
    redirect_replacement_builder,
    tls_config_builder,
) -> dict:
    router_base_name = f"redirect-{safe_name_getter(str(redirect_host.domain))}"
    host_redirect_middleware = f"{router_base_name}-host-redirect"
    force_https_middleware = f"{router_base_name}-force-https"

    escaped_domain = re.escape(str(redirect_host.domain))
    replacement = redirect_replacement_builder(redirect_host.target_url)

    middlewares: dict = {
        host_redirect_middleware: {
            "redirectRegex": {
                "regex": f"^https?://{escaped_domain}(.*)",
                "replacement": replacement,
                "permanent": redirect_host.permanent,
            }
        }
    }
    routers = _build_redirect_host_routers(
        redirect_host=redirect_host,
        router_base_name=router_base_name,
        host_redirect_middleware=host_redirect_middleware,
        force_https_middleware=force_https_middleware,
        middlewares=middlewares,
        tls_config_builder=tls_config_builder,
    )

    return {
        "http": {
            "routers": routers,
            "middlewares": middlewares,
        }
    }


def _build_redirect_host_routers(
    *,
    redirect_host: RedirectHost,
    router_base_name: str,
    host_redirect_middleware: str,
    force_https_middleware: str,
    middlewares: dict,
    tls_config_builder,
) -> dict[str, dict]:
    if not redirect_host.tls_enabled:
        return {
            f"{router_base_name}-web": {
                "rule": f"Host(`{redirect_host.domain}`)",
                "entryPoints": ["web"],
                "middlewares": [host_redirect_middleware],
                "service": "noop@internal",
            }
        }

    middlewares[force_https_middleware] = {
        "redirectScheme": {
            "scheme": "https",
            "permanent": redirect_host.permanent,
        }
    }
    return {
        f"{router_base_name}-web": {
            "rule": f"Host(`{redirect_host.domain}`)",
            "entryPoints": ["web"],
            "middlewares": [force_https_middleware],
            "service": "noop@internal",
        },
        f"{router_base_name}-websecure": {
            "rule": f"Host(`{redirect_host.domain}`)",
            "entryPoints": ["websecure"],
            "tls": tls_config_builder(),
            "middlewares": [host_redirect_middleware],
            "service": "noop@internal",
        },
    }
