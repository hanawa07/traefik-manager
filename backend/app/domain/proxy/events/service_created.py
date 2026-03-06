from dataclasses import dataclass
from datetime import datetime
from ..value_objects.service_id import ServiceId


@dataclass
class ServiceCreated:
    service_id: ServiceId
    name: str
    domain: str
    occurred_at: datetime = None

    def __post_init__(self):
        if self.occurred_at is None:
            self.occurred_at = datetime.utcnow()
