from datetime import datetime

from pydantic import BaseModel, Field


class AuditRetentionSettingsUpdateRequest(BaseModel):
    retention_days: int = Field(ge=30, le=3650)
    archive_enabled: bool


class AuditRetentionSettingsResponse(AuditRetentionSettingsUpdateRequest):
    last_run_at: datetime | None = None
    last_archived_count: int = 0
    last_deleted_count: int = 0
    last_archive_file: str | None = None
