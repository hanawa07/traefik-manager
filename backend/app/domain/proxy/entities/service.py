from dataclasses import dataclass, field
from datetime import datetime
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
    ) -> "Service":
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
    ) -> None:
        if name is not None:
            self.name = name
        if upstream_host is not None or upstream_port is not None:
            host = upstream_host or self.upstream.host
            port = upstream_port or self.upstream.port
            self.upstream = Upstream(host, port)
        if tls_enabled is not None:
            self.tls_enabled = tls_enabled
        if auth_enabled is not None:
            self.auth_enabled = auth_enabled
        self.updated_at = datetime.utcnow()
        self._events.append(ServiceUpdated(service_id=self.id))

    def delete(self) -> None:
        self._events.append(ServiceDeleted(service_id=self.id, domain=str(self.domain)))

    def pull_events(self) -> list:
        events = self._events.copy()
        self._events.clear()
        return events
