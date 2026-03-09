from dataclasses import dataclass, field
from datetime import datetime
from ipaddress import ip_network
import re
import secrets
from uuid import UUID, uuid4
from ..value_objects.domain_name import DomainName
from ..value_objects.upstream import Upstream
from ..value_objects.service_id import ServiceId
from ..events.service_created import ServiceCreated
from ..events.service_updated import ServiceUpdated
from ..events.service_deleted import ServiceDeleted


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
    ) -> "Service":
        if https_redirect_enabled and not tls_enabled:
            raise ValueError("HTTPS 리다이렉트는 TLS 활성화 시에만 사용할 수 있습니다")
        
        auth_enabled = auth_mode != "none"
        if auth_mode == "authentik" and basic_auth_users:
            raise ValueError("Authentik 인증과 Basic Auth는 동시에 활성화할 수 없습니다")
        if auth_mode == "token" and basic_auth_users:
            raise ValueError("Token 인증과 Basic Auth는 동시에 활성화할 수 없습니다")
            
        if upstream_scheme not in ["http", "https"]:
            raise ValueError("업스트림 스킴은 http 또는 https여야 합니다")

        normalized_average, normalized_burst = self._normalize_rate_limit(
            rate_limit_average=rate_limit_average,
            rate_limit_burst=rate_limit_burst,
        )

        if auth_mode == "token" and not api_key:
            api_key = f"service_{secrets.token_urlsafe(32)}"
        elif auth_mode != "token":
            api_key = None

        now = datetime.utcnow()
        service = self(
            id=ServiceId(uuid4()),
            name=name,
            domain=DomainName(domain),
            upstream=Upstream(upstream_host, upstream_port),
            tls_enabled=tls_enabled,
            auth_enabled=auth_enabled,
            auth_mode=auth_mode,
            api_key=api_key,
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
            authentik_group_id=authentik_group_id if auth_mode == "authentik" else None,
            upstream_scheme=upstream_scheme,
            skip_tls_verify=skip_tls_verify if upstream_scheme == "https" else False,
        )
        service._events.append(ServiceCreated(service_id=service.id, name=name, domain=domain))
        return service

    def update(
        self,
        name: str | None = None,
        upstream_host: str | None = None,
        upstream_port: int | None = None,
        tls_enabled: bool | None = None,
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
        
        if auth_mode is not None:
            if auth_mode == "token":
                if api_key:
                    self.api_key = api_key
                elif not self.api_key:
                    self.api_key = f"service_{secrets.token_urlsafe(32)}"
            else:
                self.api_key = None
                
            self.auth_mode = auth_mode
            self.auth_enabled = auth_mode != "none"
            if self.auth_enabled:
                self.basic_auth_users = []
            if auth_mode != "authentik":
                self.authentik_group_id = None
        elif auth_mode is None and self.auth_mode == "token" and api_key:
            # auth_mode는 유지하면서 키만 업데이트하는 경우
            self.api_key = api_key
        
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
        
        if basic_auth_users is not None:
            normalized_basic_auth_users = self._normalize_basic_auth_users(basic_auth_users)
            if normalized_basic_auth_users and self.auth_enabled:
                raise ValueError("인증 모드와 Basic Auth는 동시에 활성화할 수 없습니다")
            self.basic_auth_users = normalized_basic_auth_users
            
        if middleware_template_ids is not None:
            self.middleware_template_ids = self._normalize_middleware_template_ids(middleware_template_ids)
        if authentik_group_id is not None:
            self.authentik_group_id = authentik_group_id if self.auth_mode == "authentik" else None

        self.updated_at = datetime.utcnow()
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

    @staticmethod
    def _normalize_allowed_ips(allowed_ips: list[str] | None) -> list[str]:
        if not allowed_ips:
            return []

        normalized: list[str] = []
        seen: set[str] = set()

        for raw_ip in allowed_ips:
            value = raw_ip.strip()
            if not value:
                continue
            network = str(ip_network(value, strict=False))
            if network not in seen:
                seen.add(network)
                normalized.append(network)

        return normalized

    @staticmethod
    def _normalize_rate_limit(
        rate_limit_average: int | None,
        rate_limit_burst: int | None,
    ) -> tuple[int | None, int | None]:
        if rate_limit_average is None and rate_limit_burst is None:
            return None, None
        if rate_limit_average is None or rate_limit_burst is None:
            raise ValueError("Rate Limit을 활성화하려면 average와 burst를 모두 입력해야 합니다")
        if rate_limit_average <= 0 or rate_limit_burst <= 0:
            raise ValueError("Rate Limit 값은 1 이상의 정수여야 합니다")
        return rate_limit_average, rate_limit_burst

    @staticmethod
    def _normalize_custom_headers(custom_headers: dict[str, str] | None) -> dict[str, str]:
        if not custom_headers:
            return {}

        normalized: dict[str, str] = {}
        token_pattern = re.compile(r"^[A-Za-z0-9-]+$")

        for raw_key, raw_value in custom_headers.items():
            key = raw_key.strip()
            value = raw_value.strip()
            if not key:
                continue
            if not token_pattern.match(key):
                raise ValueError(f"유효하지 않은 헤더 키입니다: {key}")
            if "\n" in key or "\r" in key or "\n" in value or "\r" in value:
                raise ValueError(f"유효하지 않은 헤더 값입니다: {key}")
            normalized[key] = value

        return normalized

    @staticmethod
    def _normalize_basic_auth_users(basic_auth_users: list[str] | None) -> list[str]:
        if not basic_auth_users:
            return []

        normalized: list[str] = []
        seen: set[str] = set()

        for raw_user in basic_auth_users:
            value = raw_user.strip()
            if not value:
                continue
            if "\n" in value or "\r" in value:
                raise ValueError("유효하지 않은 Basic Auth 사용자 정보입니다")
            if ":" not in value:
                raise ValueError("Basic Auth 사용자 정보 형식이 올바르지 않습니다")
            username, hashed_password = value.split(":", 1)
            username = username.strip()
            hashed_password = hashed_password.strip()
            if not username or not hashed_password:
                raise ValueError("Basic Auth 사용자 정보 형식이 올바르지 않습니다")
            if ":" in username:
                raise ValueError("Basic Auth 사용자명에 ':' 문자를 사용할 수 없습니다")
            normalized_value = f"{username}:{hashed_password}"
            if normalized_value not in seen:
                seen.add(normalized_value)
                normalized.append(normalized_value)

        return normalized

    @staticmethod
    def _normalize_middleware_template_ids(template_ids: list[str] | None) -> list[str]:
        if not template_ids:
            return []

        normalized: list[str] = []
        seen: set[str] = set()
        for raw_id in template_ids:
            value = str(raw_id).strip()
            if not value:
                continue
            if value not in seen:
                seen.add(value)
                normalized.append(value)
        return normalized

    @staticmethod
    def _normalize_blocked_paths(paths: list[str] | None) -> list[str]:
        if not paths:
            return []

        normalized: list[str] = []
        seen: set[str] = set()
        for raw_path in paths:
            value = raw_path.strip()
            if not value:
                continue
            if not value.startswith("/"):
                value = "/" + value
            if value not in seen:
                seen.add(value)
                normalized.append(value)
        return normalized
