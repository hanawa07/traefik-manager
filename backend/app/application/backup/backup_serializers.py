from app.domain.proxy.entities.redirect_host import RedirectHost
from app.domain.proxy.entities.service import Service


def serialize_service(service: Service) -> dict:
    return {
        "name": service.name,
        "domain": str(service.domain),
        "upstream_host": service.upstream_host,
        "upstream_port": service.upstream_port,
        "routing_mode": service.routing_mode,
        "maintenance_message": service.maintenance_message,
        "maintenance_until": service.maintenance_until,
        "upstream_scheme": service.upstream_scheme,
        "skip_tls_verify": service.skip_tls_verify,
        "tls_enabled": service.tls_enabled,
        "https_redirect_enabled": service.https_redirect_enabled,
        "auth_enabled": service.auth_enabled,
        "allowed_ips": service.allowed_ips,
        "blocked_paths": service.blocked_paths,
        "rate_limit_average": service.rate_limit_average,
        "rate_limit_burst": service.rate_limit_burst,
        "custom_headers": service.custom_headers,
        "frame_policy": service.frame_policy,
        "healthcheck_enabled": service.healthcheck_enabled,
        "healthcheck_path": service.healthcheck_path,
        "healthcheck_timeout_ms": service.healthcheck_timeout_ms,
        "healthcheck_expected_statuses": service.healthcheck_expected_statuses,
        "basic_auth_users": service.basic_auth_users,
        "middleware_template_ids": service.middleware_template_ids,
        "authentik_provider_id": service.authentik_provider_id,
        "authentik_app_slug": service.authentik_app_slug,
        "authentik_group_id": service.authentik_group_id,
        "authentik_group_name": service.authentik_group_name,
        "authentik_policy_id": service.authentik_policy_id,
        "authentik_policy_binding_id": service.authentik_policy_binding_id,
        "cloudflare_record_id": service.cloudflare_record_id,
    }


def serialize_redirect(redirect_host: RedirectHost) -> dict:
    return {
        "domain": str(redirect_host.domain),
        "target_url": redirect_host.target_url,
        "permanent": redirect_host.permanent,
        "tls_enabled": redirect_host.tls_enabled,
    }


def serialize_preview_service_item(item: dict) -> dict:
    return {
        "domain": item["domain"],
        "name": item.get("name"),
    }


def serialize_preview_redirect_item(item: dict) -> dict:
    return {
        "domain": item["domain"],
        "name": None,
    }


def sort_preview_items(items: list[dict]) -> list[dict]:
    return sorted(items, key=lambda item: item["domain"])
