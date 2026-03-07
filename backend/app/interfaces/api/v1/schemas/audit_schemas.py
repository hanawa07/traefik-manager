from datetime import datetime
from uuid import UUID
from pydantic import BaseModel
from typing import Any

class AuditLogResponse(BaseModel):
    id: UUID
    actor: str
    action: str
    resource_type: str
    resource_id: str
    resource_name: str
    detail: dict[str, Any] | None = None
    created_at: datetime

    class Config:
        from_attributes = True
