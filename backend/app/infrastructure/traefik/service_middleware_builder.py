from app.domain.proxy.entities.middleware_template import MiddlewareTemplate
from app.domain.proxy.entities.service import Service


def append_service_middlewares(
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
        router_middlewares.append(f"{template.shared_name}@file")

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


def build_frame_policy_headers(frame_policy: str) -> dict:
    if frame_policy == "deny":
        return {"frameDeny": True}
    if frame_policy == "sameorigin":
        return {"customFrameOptionsValue": "SAMEORIGIN"}
    raise ValueError(f"지원하지 않는 frame_policy입니다: {frame_policy}")
