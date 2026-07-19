from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


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
    previous_status: str | None = None
    checked_at: str | None = None
    created_at: datetime


class AuditCertificateSummaryResponse(BaseModel):
    window_minutes: int
    warning_count: int
    error_count: int
    recovered_count: int
    recent_events: list[AuditCertificateEventResponse]


class AuditManagerHealthSummaryResponse(BaseModel):
    window_minutes: int
    unhealthy_count: int
    recovered_count: int
    docker_unhealthy_count: int
    docker_recovered_count: int
    api_unhealthy_count: int
    api_recovered_count: int
    watchdog_unhealthy_count: int
    watchdog_recovered_count: int


class AuditBulkOperationSummaryResponse(BaseModel):
    operation_id: UUID
    actor: str
    service_count: int
    service_names: list[str]
    routing_mode_after: str | None = None
    completed_at: datetime
    notification_status: Literal["success", "failure", "none"]
    notification_audit_id: UUID | None = None
    notification_provider: str | None = None


class AuditDeliveryRetryResponse(BaseModel):
    success: bool
    message: str
    detail: str | None = None
    provider: str | None = None
    source_event: str | None = None
