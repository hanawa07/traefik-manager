from dataclasses import dataclass, field
from datetime import datetime
from ipaddress import ip_network
import re
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
    https_redirect_enabled: bool = True
    allowed_ips: list[str] = field(default_factory=list)
    rate_limit_average: int | None = None
    rate_limit_burst: int | None = None
    custom_headers: dict[str, str] = field(default_factory=dict)
    authentik_provider_id: str | None = None
    authentik_app_slug: str | None = None
    authentik_group_id: str | None = None
    authentik_group_name: str | None = None
    authentik_policy_id: str | None = None
    authentik_policy_binding_id: str | None = None
    _events: list = field(default_factory=list, repr=False)

    @classmethod
    def create(
        cls,
        name: str,
        domain: str,
        upstream_host: str,
        upstream_port: int,
        tls_enabled: bool = True,
        auth_enabled: bool = False,
        https_redirect_enabled: bool = True,
        allowed_ips: list[str] | None = None,
        rate_limit_average: int | None = None,
        rate_limit_burst: int | None = None,
        custom_headers: dict[str, str] | None = None,
        authentik_group_id: str | None = None,
    ) -> "Service":
        if https_redirect_enabled and not tls_enabled:
            raise ValueError("HTTPS 리다이렉트는 TLS 활성화 시에만 사용할 수 있습니다")

        normalized_average, normalized_burst = cls._normalize_rate_limit(
            rate_limit_average=rate_limit_average,
            rate_limit_burst=rate_limit_burst,
        )

        now = datetime.utcnow()
        service = cls(
            id=ServiceId(uuid4()),
            name=name,
            domain=DomainName(domain),
            upstream=Upstream(upstream_host, upstream_port),
            tls_enabled=tls_enabled,
            auth_enabled=auth_enabled,
            created_at=now,
            updated_at=now,
            https_redirect_enabled=https_redirect_enabled,
            allowed_ips=cls._normalize_allowed_ips(allowed_ips),
            rate_limit_average=normalized_average,
            rate_limit_burst=normalized_burst,
            custom_headers=cls._normalize_custom_headers(custom_headers),
            authentik_group_id=authentik_group_id if auth_enabled else None,
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
        https_redirect_enabled: bool | None = None,
        allowed_ips: list[str] | None = None,
        rate_limit_average: int | None = None,
        rate_limit_burst: int | None = None,
        custom_headers: dict[str, str] | None = None,
        authentik_group_id: str | None = None,
        clear_rate_limit: bool = False,
    ) -> None:
        if name is not None:
            self.name = name
        if upstream_host is not None or upstream_port is not None:
            host = upstream_host or self.upstream.host
            port = upstream_port or self.upstream.port
            self.upstream = Upstream(host, port)
        if tls_enabled is not None:
            self.tls_enabled = tls_enabled
            if not tls_enabled:
                self.https_redirect_enabled = False
        if auth_enabled is not None:
            self.auth_enabled = auth_enabled
            if not auth_enabled:
                self.authentik_group_id = None
        if https_redirect_enabled is not None:
            if https_redirect_enabled and not self.tls_enabled:
                raise ValueError("HTTPS 리다이렉트는 TLS 활성화 시에만 사용할 수 있습니다")
            self.https_redirect_enabled = https_redirect_enabled
        if allowed_ips is not None:
            self.allowed_ips = self._normalize_allowed_ips(allowed_ips)
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
        if authentik_group_id is not None:
            self.authentik_group_id = authentik_group_id if self.auth_enabled else None

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
