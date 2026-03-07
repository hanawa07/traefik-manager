from dataclasses import dataclass, field
from datetime import datetime
from ipaddress import ip_network
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
        authentik_group_id: str | None = None,
    ) -> "Service":
        if https_redirect_enabled and not tls_enabled:
            raise ValueError("HTTPS 리다이렉트는 TLS 활성화 시에만 사용할 수 있습니다")

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
        authentik_group_id: str | None = None,
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
