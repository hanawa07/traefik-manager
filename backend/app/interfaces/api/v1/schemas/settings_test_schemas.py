from datetime import datetime

from pydantic import BaseModel


class SettingsTestActionResponse(BaseModel):
    success: bool
    message: str
    detail: str | None = None
    provider: str | None = None


class SettingsRollbackActionResponse(BaseModel):
    success: bool
    message: str
    resource_name: str
    event: str


class SettingsTestHistoryItemResponse(BaseModel):
    last_event: str | None = None
    last_success: bool | None = None
    last_message: str | None = None
    last_detail: str | None = None
    last_provider: str | None = None
    last_created_at: datetime | None = None
    last_success_at: datetime | None = None
    last_failure_at: datetime | None = None
    last_failure_audit_id: str | None = None
    last_failure_message: str | None = None
    last_failure_detail: str | None = None
    last_failure_provider: str | None = None
    recent_failure_count: int = 0


class SettingsTestHistoryResponse(BaseModel):
    cloudflare: SettingsTestHistoryItemResponse
    cloudflare_drift: SettingsTestHistoryItemResponse
    cloudflare_reconcile: SettingsTestHistoryItemResponse
    security_alert: SettingsTestHistoryItemResponse
    smoke_admin_stale: SettingsTestHistoryItemResponse
    security_alert_delivery: SettingsTestHistoryItemResponse
    change_alert_delivery: SettingsTestHistoryItemResponse
