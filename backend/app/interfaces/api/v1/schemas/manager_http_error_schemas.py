from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.application.manager_http_error_monitoring import (
    DEFAULT_MANAGER_HTTP_ERROR_WINDOW_MINUTES,
    MAX_MANAGER_HTTP_EXCLUDED_PATHS,
    MAX_MANAGER_HTTP_ERROR_WINDOW_MINUTES,
    MIN_MANAGER_HTTP_ERROR_WINDOW_MINUTES,
    normalize_manager_http_excluded_paths,
)


class ManagerHttpErrorBucketResponse(BaseModel):
    started_at: datetime
    not_found_count: int = Field(default=0, ge=0)
    server_error_count: int = Field(default=0, ge=0)


class ManagerHttpErrorPathResponse(BaseModel):
    path: str
    not_found_count: int = Field(default=0, ge=0)
    server_error_count: int = Field(default=0, ge=0)
    last_seen_at: datetime


class ManagerHttpClientCancellationPathResponse(BaseModel):
    path: str
    count: int = Field(default=0, ge=0)
    last_seen_at: datetime


class ManagerHttpClientCancellationSummaryResponse(BaseModel):
    available: bool
    message: str
    observed_since: datetime | None = None
    sample_coverage_percent: int = Field(default=0, ge=0, le=100)
    count: int = Field(default=0, ge=0)
    top_paths: list[ManagerHttpClientCancellationPathResponse] = Field(
        default_factory=list,
        max_length=3,
    )


class ManagerHttpRequestLogStorageResponse(BaseModel):
    source: Literal["persistent", "docker", "unavailable"] = "unavailable"
    size_bytes: int = Field(default=0, ge=0)
    capacity_bytes: int = Field(default=0, ge=0)
    file_count: int = Field(default=0, ge=0)
    max_file_count: int = Field(default=0, ge=0)
    rotated_file_count: int = Field(default=0, ge=0)


class ManagerHttpDeploymentCorrelationResponse(BaseModel):
    version: str
    revision: str
    status: Literal[
        "success",
        "failed_before_switch",
        "rolled_back",
        "rollback_failed",
    ]
    started_at: datetime
    completed_at: datetime
    window_started_at: datetime
    window_ended_at: datetime
    sample_complete: bool
    not_found_count: int = Field(default=0, ge=0)
    server_error_count: int = Field(default=0, ge=0)
    top_paths: list[ManagerHttpErrorPathResponse] = Field(
        default_factory=list,
        max_length=3,
    )


class ManagerHttpErrorSummaryResponse(BaseModel):
    available: bool
    message: str
    window_hours: int = Field(default=24, ge=1)
    path_filter: str | None = None
    checked_at: datetime
    observed_since: datetime | None = None
    sample_coverage_percent: int = Field(default=0, ge=0, le=100)
    not_found_count: int = Field(default=0, ge=0)
    server_error_count: int = Field(default=0, ge=0)
    buckets: list[ManagerHttpErrorBucketResponse] = Field(default_factory=list)
    top_paths: list[ManagerHttpErrorPathResponse] = Field(default_factory=list)
    deployment_correlations: list[ManagerHttpDeploymentCorrelationResponse] = Field(
        default_factory=list,
        max_length=5,
    )
    client_cancellation: ManagerHttpClientCancellationSummaryResponse | None = None
    log_storage: ManagerHttpRequestLogStorageResponse = Field(
        default_factory=ManagerHttpRequestLogStorageResponse
    )


class ManagerHttpErrorPreviewRequest(BaseModel):
    window_minutes: int = Field(
        default=DEFAULT_MANAGER_HTTP_ERROR_WINDOW_MINUTES,
        ge=MIN_MANAGER_HTTP_ERROR_WINDOW_MINUTES,
        le=MAX_MANAGER_HTTP_ERROR_WINDOW_MINUTES,
    )
    excluded_paths: list[str] = Field(
        default_factory=list,
        max_length=MAX_MANAGER_HTTP_EXCLUDED_PATHS,
    )

    @field_validator("excluded_paths")
    @classmethod
    def validate_excluded_paths(cls, value: list[str]) -> list[str]:
        return list(normalize_manager_http_excluded_paths(value))


class ManagerHttpExcludedPathPreviewResponse(BaseModel):
    path: str
    not_found_count: int = Field(default=0, ge=0)
    server_error_count: int = Field(default=0, ge=0)
    last_seen_at: datetime | None = None


class ManagerHttpErrorPreviewResponse(BaseModel):
    available: bool
    message: str
    window_hours: int = Field(default=24, ge=1, le=24)
    window_minutes: int = Field(ge=5, le=60)
    checked_at: datetime
    observed_since: datetime | None = None
    sample_coverage_percent: int = Field(default=0, ge=0, le=100)
    peak_not_found_count: int = Field(default=0, ge=0)
    peak_server_error_count: int = Field(default=0, ge=0)
    recommended_not_found_threshold: int = Field(ge=1, le=10_000)
    recommended_server_error_threshold: int = Field(ge=1, le=10_000)
    excluded_paths: list[ManagerHttpExcludedPathPreviewResponse] = Field(
        default_factory=list,
        max_length=50,
    )


class ManagerHttpErrorMonitorResponse(BaseModel):
    enabled: bool
    available: bool
    checked_at: datetime | None = None
    last_alert_at: datetime | None = None
    breached: bool
    window_minutes: int = Field(ge=5, le=60)
    not_found_count: int = Field(default=0, ge=0)
    not_found_threshold: int = Field(ge=1, le=10_000)
    server_error_count: int = Field(default=0, ge=0)
    server_error_threshold: int = Field(ge=1, le=10_000)
    excluded_paths: list[str] = Field(default_factory=list, max_length=50)
