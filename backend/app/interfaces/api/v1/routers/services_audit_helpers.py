from copy import deepcopy

SERVICE_CREATE_EVENT = "service_create"
SERVICE_UPDATE_EVENT = "service_update"
SERVICE_DELETE_EVENT = "service_delete"
SERVICE_ROLLBACK_EVENT = "service_rollback"


def service_resource_id(service) -> str:
    service_id = getattr(service, "id", None)
    return str(getattr(service_id, "value", service_id))


def service_audit_summary(service) -> dict[str, object]:
    return {
        "name": getattr(service, "name", ""),
        "upstream_host": getattr(service, "upstream_host", ""),
        "upstream_port": getattr(service, "upstream_port", 0),
        "routing_mode": getattr(service, "routing_mode", "active"),
        "upstream_scheme": getattr(service, "upstream_scheme", "http"),
        "skip_tls_verify": bool(getattr(service, "skip_tls_verify", False)),
        "tls_enabled": bool(getattr(service, "tls_enabled", True)),
        "https_redirect_enabled": bool(getattr(service, "https_redirect_enabled", True)),
        "auth_mode": getattr(service, "auth_mode", "none"),
        "api_key_configured": bool(getattr(service, "api_key", None)),
        "allowed_ips": deepcopy(getattr(service, "allowed_ips", [])),
        "blocked_paths": deepcopy(getattr(service, "blocked_paths", [])),
        "middleware_template_ids": deepcopy(getattr(service, "middleware_template_ids", [])),
        "rate_limit_enabled": bool(getattr(service, "rate_limit_enabled", False)),
        "rate_limit_average": getattr(service, "rate_limit_average", None),
        "rate_limit_burst": getattr(service, "rate_limit_burst", None),
        "custom_headers": deepcopy(getattr(service, "custom_headers", {})),
        "frame_policy": getattr(service, "frame_policy", "deny"),
        "healthcheck_enabled": bool(getattr(service, "healthcheck_enabled", True)),
        "healthcheck_path": getattr(service, "healthcheck_path", "/"),
        "healthcheck_timeout_ms": getattr(service, "healthcheck_timeout_ms", 3000),
        "healthcheck_expected_statuses": deepcopy(getattr(service, "healthcheck_expected_statuses", [])),
        "basic_auth_enabled": bool(getattr(service, "basic_auth_enabled", False)),
        "basic_auth_user_count": len(getattr(service, "basic_auth_users", [])),
        "authentik_group_id": getattr(service, "authentik_group_id", None),
    }


def changed_service_keys(before_summary: dict[str, object], after_summary: dict[str, object]) -> list[str]:
    return sorted(
        [
            key
            for key in set(before_summary.keys()) | set(after_summary.keys())
            if before_summary.get(key) != after_summary.get(key)
        ]
    )


def build_service_rollback_payload(before_service, after_service) -> dict[str, object] | None:
    if not _service_supports_rollback(before_service, after_service):
        return None

    before_summary = service_audit_summary(before_service)
    after_summary = service_audit_summary(after_service)
    changed_keys = changed_service_keys(before_summary, after_summary)
    payload: dict[str, object] = {}
    copyable_keys = {
        "name",
        "upstream_host",
        "upstream_port",
        "routing_mode",
        "upstream_scheme",
        "skip_tls_verify",
        "tls_enabled",
        "https_redirect_enabled",
        "auth_mode",
        "allowed_ips",
        "blocked_paths",
        "middleware_template_ids",
        "custom_headers",
        "frame_policy",
        "healthcheck_enabled",
        "healthcheck_path",
        "healthcheck_timeout_ms",
        "healthcheck_expected_statuses",
        "authentik_group_id",
    }
    for key in changed_keys:
        if key in copyable_keys:
            payload[key] = deepcopy(before_summary[key])

    if any(key in changed_keys for key in ("rate_limit_enabled", "rate_limit_average", "rate_limit_burst")):
        if before_summary["rate_limit_enabled"]:
            payload["rate_limit_enabled"] = True
            payload["rate_limit_average"] = before_summary["rate_limit_average"]
            payload["rate_limit_burst"] = before_summary["rate_limit_burst"]
        else:
            payload["rate_limit_enabled"] = False

    return payload or None


def _service_supports_rollback(before_service, after_service) -> bool:
    return not any(
        getattr(service, "auth_mode", "none") == "token" or bool(getattr(service, "basic_auth_users", []))
        for service in (before_service, after_service)
    )
