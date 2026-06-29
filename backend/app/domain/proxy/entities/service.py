from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID, uuid4
from ..value_objects.domain_name import DomainName
from ..value_objects.upstream import Upstream
from ..value_objects.service_id import ServiceId
from ..events.service_created import ServiceCreated
from ..events.service_updated import ServiceUpdated
from ..events.service_deleted import ServiceDeleted
from .service_auth_policy import (
    ensure_basic_auth_allowed,
    resolve_created_auth_state,
    resolve_updated_auth_state,
)
from .service_normalizers import (
    AUTH_MODE_VALUES,
    DEFAULT_HEALTHCHECK_PATH,
    DEFAULT_HEALTHCHECK_TIMEOUT_MS,
    FRAME_POLICY_VALUES,
    normalize_allowed_ips,
    normalize_basic_auth_users,
    normalize_blocked_paths,
    normalize_custom_headers,
    normalize_frame_policy,
    normalize_healthcheck_expected_statuses,
    normalize_healthcheck_path,
    normalize_healthcheck_timeout_ms,
    normalize_middleware_template_ids,
    normalize_rate_limit,
)

__all__ = [
    "AUTH_MODE_VALUES",
    "DEFAULT_HEALTHCHECK_PATH",
    "DEFAULT_HEALTHCHECK_TIMEOUT_MS",
    "FRAME_POLICY_VALUES",
    "Service",
]


@dataclass
class Service:
    """서비스 Aggregate Root - Traefik 라우터 하나를 표현"""

    id: ServiceId
    name: str
    domain: DomainName
    upstream: Upstream
    tls_enabled: bool
    auth_enabled: bool
    created_at: datetime
    updated_at: datetime
    auth_mode: str = "none"  # "none" | "authentik" | "token"
    api_key: str | None = None
    https_redirect_enabled: bool = True
    allowed_ips: list[str] = field(default_factory=list)
    blocked_paths: list[str] = field(default_factory=list)
    rate_limit_average: int | None = None
    rate_limit_burst: int | None = None
    custom_headers: dict[str, str] = field(default_factory=dict)
    basic_auth_users: list[str] = field(default_factory=list)
    middleware_template_ids: list[str] = field(default_factory=list)
    authentik_provider_id: str | None = None
    authentik_app_slug: str | None = None
    authentik_group_id: str | None = None
    authentik_group_name: str | None = None
    authentik_policy_id: str | None = None
    authentik_policy_binding_id: str | None = None
    cloudflare_record_id: str | None = None
    upstream_scheme: str = "http"
    skip_tls_verify: bool = False
    frame_policy: str = "deny"
    healthcheck_enabled: bool = True
    healthcheck_path: str = DEFAULT_HEALTHCHECK_PATH
    healthcheck_timeout_ms: int = DEFAULT_HEALTHCHECK_TIMEOUT_MS
    healthcheck_expected_statuses: list[int] = field(default_factory=list)
    _events: list = field(default_factory=list, repr=False)

    @property
    def uses_authentik(self) -> bool:
        return self.auth_mode == "authentik"

    @property
    def uses_token_auth(self) -> bool:
        return self.auth_mode == "token"

    @classmethod
    def create(
        self,
        name: str,
        domain: str,
        upstream_host: str,
        upstream_port: int,
        tls_enabled: bool = True,
        auth_enabled: bool | None = None,
        auth_mode: str = "none",
        api_key: str | None = None,
        https_redirect_enabled: bool = True,
        allowed_ips: list[str] | None = None,
        blocked_paths: list[str] | None = None,
        rate_limit_average: int | None = None,
        rate_limit_burst: int | None = None,
        custom_headers: dict[str, str] | None = None,
        basic_auth_users: list[str] | None = None,
        middleware_template_ids: list[str] | None = None,
        authentik_group_id: str | None = None,
        upstream_scheme: str = "http",
        skip_tls_verify: bool = False,
        frame_policy: str = "deny",
        healthcheck_enabled: bool = True,
        healthcheck_path: str = DEFAULT_HEALTHCHECK_PATH,
        healthcheck_timeout_ms: int = DEFAULT_HEALTHCHECK_TIMEOUT_MS,
        healthcheck_expected_statuses: list[int] | None = None,
    ) -> "Service":
        if https_redirect_enabled and not tls_enabled:
            raise ValueError("HTTPS 리다이렉트는 TLS 활성화 시에만 사용할 수 있습니다")

        auth_state = resolve_created_auth_state(
            auth_mode=auth_mode,
            auth_enabled=auth_enabled,
            api_key=api_key,
            basic_auth_users=basic_auth_users,
            authentik_group_id=authentik_group_id,
        )
            
        if upstream_scheme not in ["http", "https"]:
            raise ValueError("업스트림 스킴은 http 또는 https여야 합니다")

        normalized_average, normalized_burst = self._normalize_rate_limit(
            rate_limit_average=rate_limit_average,
            rate_limit_burst=rate_limit_burst,
        )

        now = datetime.now(timezone.utc)
        service = self(
            id=ServiceId(uuid4()),
            name=name,
            domain=DomainName(domain),
            upstream=Upstream(upstream_host, upstream_port),
            tls_enabled=tls_enabled,
            auth_enabled=auth_state.auth_enabled,
            auth_mode=auth_state.auth_mode,
            api_key=auth_state.api_key,
            created_at=now,
            updated_at=now,
            https_redirect_enabled=https_redirect_enabled,
            allowed_ips=self._normalize_allowed_ips(allowed_ips),
            blocked_paths=self._normalize_blocked_paths(blocked_paths),
            rate_limit_average=normalized_average,
            rate_limit_burst=normalized_burst,
            custom_headers=self._normalize_custom_headers(custom_headers),
            basic_auth_users=self._normalize_basic_auth_users(basic_auth_users),
            middleware_template_ids=self._normalize_middleware_template_ids(middleware_template_ids),
            authentik_group_id=auth_state.authentik_group_id,
            upstream_scheme=upstream_scheme,
            skip_tls_verify=skip_tls_verify if upstream_scheme == "https" else False,
            frame_policy=self._normalize_frame_policy(frame_policy),
            healthcheck_enabled=healthcheck_enabled,
            healthcheck_path=self._normalize_healthcheck_path(healthcheck_path),
            healthcheck_timeout_ms=self._normalize_healthcheck_timeout_ms(healthcheck_timeout_ms),
            healthcheck_expected_statuses=self._normalize_healthcheck_expected_statuses(
                healthcheck_expected_statuses
            ),
        )
        service._events.append(ServiceCreated(service_id=service.id, name=name, domain=domain))
        return service

    def update(
        self,
        name: str | None = None,
        upstream_host: str | None = None,
        upstream_port: int | None = None,
        tls_enabled: bool | None = None,
        auth_enabled: bool | None = None,
        auth_mode: str | None = None,
        api_key: str | None = None,
        https_redirect_enabled: bool | None = None,
        allowed_ips: list[str] | None = None,
        blocked_paths: list[str] | None = None,
        rate_limit_average: int | None = None,
        rate_limit_burst: int | None = None,
        custom_headers: dict[str, str] | None = None,
        basic_auth_users: list[str] | None = None,
        middleware_template_ids: list[str] | None = None,
        authentik_group_id: str | None = None,
        clear_rate_limit: bool = False,
        upstream_scheme: str | None = None,
        skip_tls_verify: bool | None = None,
        frame_policy: str | None = None,
        healthcheck_enabled: bool | None = None,
        healthcheck_path: str | None = None,
        healthcheck_timeout_ms: int | None = None,
        healthcheck_expected_statuses: list[int] | None = None,
    ) -> None:
        if name is not None:
            self.name = name
        if upstream_host is not None or upstream_port is not None:
            host = upstream_host or self.upstream.host
            port = upstream_port or self.upstream.port
            self.upstream = Upstream(host, port)
        if upstream_scheme is not None:
            if upstream_scheme not in ["http", "https"]:
                raise ValueError("업스트림 스킴은 http 또는 https여야 합니다")
            self.upstream_scheme = upstream_scheme
            if upstream_scheme == "http":
                self.skip_tls_verify = False
        if skip_tls_verify is not None:
            self.skip_tls_verify = skip_tls_verify if self.upstream_scheme == "https" else False
        if tls_enabled is not None:
            self.tls_enabled = tls_enabled
            if not tls_enabled:
                self.https_redirect_enabled = False

        auth_state = resolve_updated_auth_state(
            current_auth_mode=self.auth_mode,
            current_api_key=self.api_key,
            requested_auth_mode=auth_mode,
            requested_auth_enabled=auth_enabled,
            requested_api_key=api_key,
        )
        if auth_state is not None:
            self.auth_mode = auth_state.auth_mode
            self.auth_enabled = auth_state.auth_enabled
            self.api_key = auth_state.api_key
            if auth_state.clear_basic_auth_users:
                self.basic_auth_users = []
            if auth_state.clear_authentik_group:
                self.authentik_group_id = None
        
        if https_redirect_enabled is not None:
            if https_redirect_enabled and not self.tls_enabled:
                raise ValueError("HTTPS 리다이렉트는 TLS 활성화 시에만 사용할 수 있습니다")
            self.https_redirect_enabled = https_redirect_enabled
        if allowed_ips is not None:
            self.allowed_ips = self._normalize_allowed_ips(allowed_ips)
        if blocked_paths is not None:
            self.blocked_paths = self._normalize_blocked_paths(blocked_paths)
        if clear_rate_limit:
            self.rate_limit_average = None
            self.rate_limit_burst = None
        elif rate_limit_average is not None or rate_limit_burst is not None:
            normalized_average, normalized_burst = self._normalize_rate_limit(
                rate_limit_average=(
                    rate_limit_average if rate_limit_average is not None else self.rate_limit_average
                ),
                rate_limit_burst=(
                    rate_limit_burst if rate_limit_burst is not None else self.rate_limit_burst
                ),
            )
            self.rate_limit_average = normalized_average
            self.rate_limit_burst = normalized_burst
        if custom_headers is not None:
            self.custom_headers = self._normalize_custom_headers(custom_headers)
        if frame_policy is not None:
            self.frame_policy = self._normalize_frame_policy(frame_policy)
        if healthcheck_enabled is not None:
            self.healthcheck_enabled = healthcheck_enabled
        if healthcheck_path is not None:
            self.healthcheck_path = self._normalize_healthcheck_path(healthcheck_path)
        if healthcheck_timeout_ms is not None:
            self.healthcheck_timeout_ms = self._normalize_healthcheck_timeout_ms(healthcheck_timeout_ms)
        if healthcheck_expected_statuses is not None:
            self.healthcheck_expected_statuses = self._normalize_healthcheck_expected_statuses(
                healthcheck_expected_statuses
            )
        
        if basic_auth_users is not None:
            normalized_basic_auth_users = self._normalize_basic_auth_users(basic_auth_users)
            ensure_basic_auth_allowed(self.auth_enabled, normalized_basic_auth_users)
            self.basic_auth_users = normalized_basic_auth_users
            
        if middleware_template_ids is not None:
            self.middleware_template_ids = self._normalize_middleware_template_ids(middleware_template_ids)
        if authentik_group_id is not None:
            self.authentik_group_id = authentik_group_id if self.auth_mode == "authentik" else None

        self.updated_at = datetime.now(timezone.utc)
        self._events.append(ServiceUpdated(service_id=self.id))

    def delete(self) -> None:
        self._events.append(ServiceDeleted(service_id=self.id, domain=str(self.domain)))

    def pull_events(self) -> list:
        events = self._events.copy()
        self._events.clear()
        return events

    @property
    def upstream_host(self) -> str:
        return self.upstream.host

    @property
    def upstream_port(self) -> int:
        return self.upstream.port

    @property
    def rate_limit_enabled(self) -> bool:
        return self.rate_limit_average is not None and self.rate_limit_burst is not None

    @property
    def basic_auth_enabled(self) -> bool:
        return len(self.basic_auth_users) > 0

    @property
    def basic_auth_user_count(self) -> int:
        return len(self.basic_auth_users)

    @property
    def basic_auth_usernames(self) -> list[str]:
        return [user.split(":")[0] for user in self.basic_auth_users]

    _normalize_frame_policy = staticmethod(normalize_frame_policy)
    _normalize_healthcheck_path = staticmethod(normalize_healthcheck_path)
    _normalize_healthcheck_timeout_ms = staticmethod(normalize_healthcheck_timeout_ms)
    _normalize_healthcheck_expected_statuses = staticmethod(normalize_healthcheck_expected_statuses)
    _normalize_allowed_ips = staticmethod(normalize_allowed_ips)
    _normalize_rate_limit = staticmethod(normalize_rate_limit)
    _normalize_custom_headers = staticmethod(normalize_custom_headers)
    _normalize_basic_auth_users = staticmethod(normalize_basic_auth_users)
    _normalize_middleware_template_ids = staticmethod(normalize_middleware_template_ids)
    _normalize_blocked_paths = staticmethod(normalize_blocked_paths)
