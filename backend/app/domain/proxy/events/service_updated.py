from dataclasses import dataclass
from datetime import datetime, timezone
from ..value_objects.service_id import ServiceId


@dataclass
class ServiceUpdated:
    service_id: ServiceId
    occurred_at: datetime = None

    def __post_init__(self):
        if self.occurred_at is None:
            self.occurred_at = datetime.now(timezone.utc)
