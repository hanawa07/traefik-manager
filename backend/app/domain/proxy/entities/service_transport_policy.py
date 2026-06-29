from dataclasses import dataclass


@dataclass(frozen=True)
class ServiceTransportState:
    upstream_scheme: str
    skip_tls_verify: bool


def ensure_https_redirect_allowed(
    *,
    tls_enabled: bool,
    https_redirect_enabled: bool,
) -> None:
    if https_redirect_enabled and not tls_enabled:
        raise ValueError("HTTPS 리다이렉트는 TLS 활성화 시에만 사용할 수 있습니다")


def resolve_created_transport_state(
    *,
    upstream_scheme: str,
    skip_tls_verify: bool,
) -> ServiceTransportState:
    resolved_scheme = _validate_upstream_scheme(upstream_scheme)
    return ServiceTransportState(
        upstream_scheme=resolved_scheme,
        skip_tls_verify=skip_tls_verify if resolved_scheme == "https" else False,
    )


def resolve_updated_transport_state(
    *,
    current_upstream_scheme: str,
    current_skip_tls_verify: bool,
    requested_upstream_scheme: str | None,
    requested_skip_tls_verify: bool | None,
) -> ServiceTransportState | None:
    if requested_upstream_scheme is None and requested_skip_tls_verify is None:
        return None

    resolved_scheme = (
        _validate_upstream_scheme(requested_upstream_scheme)
        if requested_upstream_scheme is not None
        else current_upstream_scheme
    )
    skip_tls_verify = current_skip_tls_verify if resolved_scheme == "https" else False
    if requested_skip_tls_verify is not None:
        skip_tls_verify = requested_skip_tls_verify if resolved_scheme == "https" else False

    return ServiceTransportState(
        upstream_scheme=resolved_scheme,
        skip_tls_verify=skip_tls_verify,
    )


def _validate_upstream_scheme(upstream_scheme: str) -> str:
    if upstream_scheme not in ["http", "https"]:
        raise ValueError("업스트림 스킴은 http 또는 https여야 합니다")
    return upstream_scheme
