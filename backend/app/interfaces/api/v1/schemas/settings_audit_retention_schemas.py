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


class AuditArchiveResponse(BaseModel):
    filename: str
    size_bytes: int = Field(ge=0)
    modified_at: datetime


class AuditArchiveListResponse(BaseModel):
    archives: list[AuditArchiveResponse] = Field(default_factory=list)


class AuditArchiveRestoreResponse(BaseModel):
    filename: str
    total_count: int = Field(ge=0)
    restored_count: int = Field(ge=0)
    skipped_count: int = Field(ge=0)
