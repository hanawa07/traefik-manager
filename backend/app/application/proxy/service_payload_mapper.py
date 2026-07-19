from typing import Any

from app.application.proxy.basic_auth_credentials import hash_basic_auth_credentials
from app.domain.proxy.entities.service import Service


def create_service_from_payload(data: Any) -> Service:
    return Service.create(
        name=data.name,
        domain=data.domain,
        upstream_host=data.upstream_host,
        upstream_port=data.upstream_port,
        routing_mode=getattr(data, "routing_mode", "active"),
        maintenance_message=getattr(data, "maintenance_message", ""),
        maintenance_until=getattr(data, "maintenance_until", None),
        tls_enabled=data.tls_enabled,
        auth_mode=data.auth_mode,
        api_key=data.api_key,
        https_redirect_enabled=data.https_redirect_enabled,
        allowed_ips=data.allowed_ips,
        blocked_paths=data.blocked_paths,
        rate_limit_average=data.rate_limit_average,
        rate_limit_burst=data.rate_limit_burst,
        custom_headers=data.custom_headers,
        basic_auth_users=(
            hash_basic_auth_credentials(data.basic_auth_credentials)
            if data.basic_auth_enabled
            else []
        ),
        middleware_template_ids=data.middleware_template_ids,
        authentik_group_id=data.authentik_group_id,
        upstream_scheme=data.upstream_scheme,
        skip_tls_verify=data.skip_tls_verify,
        frame_policy=data.frame_policy,
        healthcheck_enabled=getattr(data, "healthcheck_enabled", True),
        healthcheck_path=getattr(data, "healthcheck_path", "/"),
        healthcheck_timeout_ms=getattr(data, "healthcheck_timeout_ms", 3000),
        healthcheck_expected_statuses=getattr(data, "healthcheck_expected_statuses", []),
    )


def apply_service_update_payload(service: Service, update_payload: dict[str, Any]) -> None:
    if (
        update_payload.get("basic_auth_enabled") is True
        and not service.basic_auth_enabled
        and "basic_auth_credentials" not in update_payload
    ):
        raise ValueError("Basic Auth를 활성화하려면 사용자 이름과 비밀번호를 입력해야 합니다")

    service.update(
        name=update_payload.get("name"),
        upstream_host=update_payload.get("upstream_host"),
        upstream_port=update_payload.get("upstream_port"),
        routing_mode=update_payload.get("routing_mode"),
        maintenance_message=update_payload.get("maintenance_message"),
        maintenance_until=update_payload.get("maintenance_until"),
        clear_maintenance_until=(
            "maintenance_until" in update_payload
            and update_payload.get("maintenance_until") is None
        ),
        tls_enabled=update_payload.get("tls_enabled"),
        auth_mode=update_payload.get("auth_mode"),
        api_key=update_payload.get("api_key"),
        https_redirect_enabled=update_payload.get("https_redirect_enabled"),
        allowed_ips=update_payload.get("allowed_ips"),
        blocked_paths=update_payload.get("blocked_paths"),
        rate_limit_average=update_payload.get("rate_limit_average"),
        rate_limit_burst=update_payload.get("rate_limit_burst"),
        custom_headers=update_payload.get("custom_headers"),
        basic_auth_users=_resolve_basic_auth_users(service, update_payload),
        middleware_template_ids=update_payload.get("middleware_template_ids"),
        clear_rate_limit=update_payload.get("rate_limit_enabled") is False,
        upstream_scheme=update_payload.get("upstream_scheme"),
        skip_tls_verify=update_payload.get("skip_tls_verify"),
        frame_policy=update_payload.get("frame_policy"),
        healthcheck_enabled=update_payload.get("healthcheck_enabled"),
        healthcheck_path=update_payload.get("healthcheck_path"),
        healthcheck_timeout_ms=update_payload.get("healthcheck_timeout_ms"),
        healthcheck_expected_statuses=update_payload.get("healthcheck_expected_statuses"),
    )

    if "authentik_group_id" in update_payload:
        service.authentik_group_id = (
            update_payload.get("authentik_group_id") if service.uses_authentik else None
        )


def _resolve_basic_auth_users(
    service: Service,
    update_payload: dict[str, Any],
) -> list[str] | None:
    if update_payload.get("basic_auth_enabled") is False:
        return []
    if "basic_auth_credentials" not in update_payload:
        return None
    return hash_basic_auth_credentials(
        update_payload.get("basic_auth_credentials") or [],
        existing_users=service.basic_auth_users,
    )
