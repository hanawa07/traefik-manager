from dataclasses import dataclass
from datetime import datetime
from ..value_objects.service_id import ServiceId


@dataclass
class ServiceDeleted:
    service_id: ServiceId
    domain: str
    occurred_at: datetime = None

    def __post_init__(self):
        if self.occurred_at is None:
            self.occurred_at = datetime.utcnow()
