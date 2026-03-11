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
    event: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class AuditSecurityEventResponse(BaseModel):
    id: UUID
    event: str
    actor: str
    resource_name: str
    client_ip: str | None = None
    created_at: datetime


class AuditSecuritySummaryResponse(BaseModel):
    window_minutes: int
    failed_login_count: int
    locked_login_count: int
    suspicious_ip_count: int
    blocked_ip_count: int
    recent_events: list[AuditSecurityEventResponse]
