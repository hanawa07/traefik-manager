from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict
from typing import Any

class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    actor: str
    action: str
    resource_type: str
    resource_id: str
    resource_name: str
    detail: dict[str, Any] | None = None
    event: str | None = None
    created_at: datetime

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


class AuditCertificateEventResponse(BaseModel):
    id: UUID
    event: str
    actor: str
    resource_name: str
    days_remaining: int | None = None
    expires_at: str | None = None
    created_at: datetime


class AuditCertificateSummaryResponse(BaseModel):
    window_minutes: int
    warning_count: int
    error_count: int
    recent_events: list[AuditCertificateEventResponse]
