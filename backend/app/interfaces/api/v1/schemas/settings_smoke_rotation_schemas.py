from datetime import datetime
from typing import Literal

from pydantic import AwareDatetime, BaseModel, Field

SmokeMonitoringFrequency = Literal["daily", "weekly"]
SmokeFailureRateWindowDays = Literal[7, 30]
SmokeFailureType = Literal["login", "external_api", "visual_regression"]
SmokeCancellationReason = Literal["timeout", "superseded", "manual_or_unknown"]
SmokeCancellationReasonFilter = Literal[
    "all",
    "timeout",
    "superseded",
    "manual_or_unknown",
]


class SmokeFailureMetadataResponse(BaseModel):
    captured_at: datetime
    check_name: str = Field(min_length=1, max_length=500)
    failure_type: SmokeFailureType = "visual_regression"
    screen_path: str | None = Field(default=None, max_length=500)
    page_title: str | None = Field(default=None, max_length=300)


class SmokeMonitoringRecentRunResponse(BaseModel):
    run_id: int = Field(gt=0)
    status: Literal["success", "failure", "skipped", "cancelled"]
    completed_at: str
    run_url: str
    run_number: int | None = None
    commit_sha: str | None = None
    summary: str | None = None
    cancellation_reason: SmokeCancellationReason | None = None
    notification_suppressed: bool = False
    artifact_url: str | None = None
    artifact_expires_at: str | None = None
    failure_metadata: SmokeFailureMetadataResponse | None = None


class SmokeSlowRunResponse(BaseModel):
    run_id: int = Field(gt=0)
    run_number: int | None = None
    status: Literal["success", "failure", "skipped", "cancelled"]
    completed_at: str
    duration_seconds: int = Field(ge=0)
    commit_sha: str | None = None
    run_url: str


class SmokeFailureTypeCountsResponse(BaseModel):
    login: int = Field(default=0, ge=0)
    external_api: int = Field(default=0, ge=0)
    visual_regression: int = Field(default=0, ge=0)
    unclassified: int = Field(default=0, ge=0)


class SmokeFailureTypeDailyResponse(BaseModel):
    captured_on: str
    login: int = Field(default=0, ge=0)
    external_api: int = Field(default=0, ge=0)
    visual_regression: int = Field(default=0, ge=0)


class SmokeRunStatisticsResponse(BaseModel):
    window_days: SmokeFailureRateWindowDays
    total_count: int = Field(ge=0)
    success_count: int = Field(ge=0)
    failure_count: int = Field(ge=0)
    cancelled_count: int = Field(ge=0)
    skipped_count: int = Field(ge=0)
    duration_run_count: int = Field(ge=0)
    total_duration_seconds: int = Field(ge=0)
    average_duration_seconds: int = Field(ge=0)
    estimated_runner_minutes: int = Field(ge=0)
    slowest_runs: list[SmokeSlowRunResponse] = Field(default_factory=list)
    failure_type_counts: SmokeFailureTypeCountsResponse = Field(
        default_factory=SmokeFailureTypeCountsResponse
    )
    failure_type_daily: list[SmokeFailureTypeDailyResponse] = Field(default_factory=list)


class SmokeStatisticsSnapshotResponse(BaseModel):
    captured_on: str
    window_days: Literal[30]
    total_count: int = Field(ge=0)
    success_count: int = Field(ge=0)
    failure_count: int = Field(ge=0)
    cancelled_count: int = Field(ge=0)
    skipped_count: int = Field(ge=0)
    duration_run_count: int = Field(ge=0)
    total_duration_seconds: int = Field(ge=0)
    average_duration_seconds: int = Field(ge=0)
    estimated_runner_minutes: int = Field(ge=0)


class SmokeLocalRunResponse(BaseModel):
    run_id: int = Field(gt=0)
    status: Literal["success", "failure"]
    started_at: str | None = None
    completed_at: str
    duration_seconds: int | None = Field(default=None, ge=0)
    admin_checked: bool = False


class SmokeRotationStatusResponse(BaseModel):
    status: Literal["never", "running", "success", "failure"]
    last_attempt_at: str | None = None
    last_success_at: str | None = None
    detail: str | None = None
    is_stale: bool = False
    stale_after_days: int = 35
    recent_log_lines: list[str] = Field(default_factory=list)
    log_updated_at: str | None = None
    monitoring_enabled: bool = True
    monitoring_frequency: SmokeMonitoringFrequency = "daily"
    monitoring_failure_rate_threshold_percent: int = 30
    monitoring_failure_rate_min_runs: int = 3
    monitoring_failure_rate_window_days: SmokeFailureRateWindowDays = 7
    monitoring_github_rate_limit_alert_enabled: bool = False
    monitoring_github_primary_limit_alert_threshold: int = 3
    monitoring_github_secondary_limit_alert_threshold: int = 3
    monitoring_github_rate_limit_alert_window_hours: int = 24
    monitoring_schedule_time: str = "03:17"
    monitoring_schedule_timezone: str = "Asia/Seoul"
    monitoring_last_success_at: str | None = None
    monitoring_last_run_url: str | None = None
    monitoring_admin_last_success_at: str | None = None
    monitoring_admin_last_run_url: str | None = None
    monitoring_admin_is_stale: bool = False
    monitoring_admin_stale_after_days: int = 2
    monitoring_workflow_url: str
    monitoring_recent_runs: list[SmokeMonitoringRecentRunResponse] = Field(default_factory=list)
    monitoring_latest_failure: SmokeMonitoringRecentRunResponse | None = None
    monitoring_run_statistics: list[SmokeRunStatisticsResponse] = Field(default_factory=list)
    monitoring_statistics_snapshots: list[SmokeStatisticsSnapshotResponse] = Field(
        default_factory=list
    )
    monitoring_local_runs: list[SmokeLocalRunResponse] = Field(default_factory=list)
    monitoring_local_run_total: int = 0
    monitoring_local_run_limit: int = 20
    monitoring_local_run_retention_days: int = 365
    monitoring_history_checked_at: str | None = None
    monitoring_history_data_checked_at: str | None = None
    monitoring_history_error: str | None = None
    monitoring_history_days: Literal[7, 30] = 30
    monitoring_history_page: int = 1
    monitoring_history_per_page: int = 5
    monitoring_history_total: int = 0
    monitoring_history_total_pages: int = 0
    monitoring_history_search: str = ""
    monitoring_history_status: Literal["all", "success", "failure", "cancelled"] = "all"
    monitoring_history_cancellation_reason: SmokeCancellationReasonFilter = "all"
    monitoring_failure_metadata_count: int = 0
    monitoring_failure_metadata_limit: int = 20
    monitoring_github_rate_limit_remaining: int | None = None
    monitoring_github_rate_limit_limit: int | None = None
    monitoring_github_rate_limit_reset_at: str | None = None
    monitoring_github_secondary_limit_retry_at: str | None = None
    monitoring_github_refresh_reserve: int = 10
    monitoring_github_history_cache_items: int | None = None
    monitoring_github_history_cache_capacity: int | None = None
    monitoring_github_history_cache_hits: int | None = None
    monitoring_github_history_cache_misses: int | None = None
    monitoring_github_last_request_count: int | None = None
    monitoring_github_last_workflow_request_count: int | None = None
    monitoring_github_last_job_request_count: int | None = None
    monitoring_github_last_artifact_request_count: int | None = None


class SmokeMonitoringSettingsUpdateRequest(BaseModel):
    monitoring_enabled: bool
    monitoring_frequency: SmokeMonitoringFrequency
    monitoring_failure_rate_threshold_percent: int = Field(default=30, ge=1, le=100)
    monitoring_failure_rate_min_runs: int = Field(default=3, ge=1, le=30)
    monitoring_failure_rate_window_days: SmokeFailureRateWindowDays = 7
    monitoring_github_rate_limit_alert_enabled: bool = False
    monitoring_github_primary_limit_alert_threshold: int = Field(default=3, ge=1, le=100)
    monitoring_github_secondary_limit_alert_threshold: int = Field(default=3, ge=1, le=100)
    monitoring_github_rate_limit_alert_window_hours: int = Field(default=24, ge=1, le=168)


class SmokeMonitoringScheduleDecisionResponse(BaseModel):
    should_run: bool


class SmokeMonitoringRunSuccessRequest(BaseModel):
    run_id: int = Field(gt=0)
    admin_checked: bool = False
    started_at: AwareDatetime | None = None
    completed_at: AwareDatetime | None = None


class SmokeMonitoringRunSuccessResponse(BaseModel):
    recorded_at: str
    run_url: str


class SmokeMonitoringRunFailureRequest(SmokeFailureMetadataResponse):
    run_id: int = Field(gt=0)
    started_at: AwareDatetime | None = None
    completed_at: AwareDatetime | None = None


class SmokeMonitoringRunFailureResponse(SmokeMonitoringRunFailureRequest):
    pass
