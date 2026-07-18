from typing import Literal

from pydantic import BaseModel, Field

SmokeMonitoringFrequency = Literal["daily", "weekly"]


class SmokeMonitoringRecentRunResponse(BaseModel):
    status: Literal["success", "failure", "skipped"]
    completed_at: str
    run_url: str
    run_number: int | None = None
    commit_sha: str | None = None
    summary: str | None = None
    notification_suppressed: bool = False
    artifact_url: str | None = None
    artifact_expires_at: str | None = None


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
    monitoring_schedule_time: str = "03:17"
    monitoring_schedule_timezone: str = "Asia/Seoul"
    monitoring_last_success_at: str | None = None
    monitoring_last_run_url: str | None = None
    monitoring_admin_last_success_at: str | None = None
    monitoring_admin_last_run_url: str | None = None
    monitoring_workflow_url: str
    monitoring_recent_runs: list[SmokeMonitoringRecentRunResponse] = Field(default_factory=list)
    monitoring_latest_failure: SmokeMonitoringRecentRunResponse | None = None
    monitoring_history_checked_at: str | None = None
    monitoring_history_error: str | None = None


class SmokeMonitoringSettingsUpdateRequest(BaseModel):
    monitoring_enabled: bool
    monitoring_frequency: SmokeMonitoringFrequency


class SmokeMonitoringScheduleDecisionResponse(BaseModel):
    should_run: bool


class SmokeMonitoringRunSuccessRequest(BaseModel):
    run_id: int = Field(gt=0)
    admin_checked: bool = False


class SmokeMonitoringRunSuccessResponse(BaseModel):
    recorded_at: str
    run_url: str
