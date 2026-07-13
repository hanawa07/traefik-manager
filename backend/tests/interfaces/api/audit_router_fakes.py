from datetime import datetime
from uuid import uuid4

from app.infrastructure.persistence.models import AuditLogModel


class StubScalarResult:
    def __init__(self, items):
        self._items = items

    def all(self):
        return self._items

    def first(self):
        return self._items[0] if self._items else None


class StubExecuteResult:
    def __init__(self, items):
        self._items = items

    def scalars(self):
        return StubScalarResult(self._items)


class StubAuditDb:
    def __init__(self, logs):
        self._logs = logs

    async def execute(self, _query):
        return StubExecuteResult(self._logs)


def make_log(
    *,
    actor: str = "admin",
    action: str = "update",
    resource_type: str = "user",
    resource_id: str | None = None,
    resource_name: str = "admin",
    event: str | None = None,
    client_ip: str | None = None,
    created_at: datetime,
    detail_extra: dict | None = None,
):
    detail = None
    if event is not None or client_ip is not None or detail_extra:
        detail = {}
        if event is not None:
            detail["event"] = event
        if client_ip is not None:
            detail["client_ip"] = client_ip
        if detail_extra:
            detail.update(detail_extra)
    return AuditLogModel(
        id=str(uuid4()),
        actor=actor,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id or str(uuid4()),
        resource_name=resource_name,
        detail=detail,
        created_at=created_at,
    )
