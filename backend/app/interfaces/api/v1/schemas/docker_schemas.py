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


class DockerContainerPortResponse(BaseModel):
    private_port: int
    public_port: int | None = None
    type: str | None = None


class DockerTraefikCandidateResponse(BaseModel):
    router_name: str
    domain: str
    upstream_host: str
    upstream_port: int
    tls_enabled: bool


class DockerContainerResponse(BaseModel):
    id: str | None = None
    name: str
    image: str | None = None
    state: str | None = None
    status: str | None = None
    ports: list[DockerContainerPortResponse]
    networks: list[str]
    traefik_candidates: list[DockerTraefikCandidateResponse]


class DockerContainerListResponse(BaseModel):
    enabled: bool
    socket_path: str
    message: str
    containers: list[DockerContainerResponse]


class DockerDeploymentComponentResponse(BaseModel):
    name: str
    container_name: str
    status: str
    runtime_status: str | None = None
    health_status: str | None = None
    health_failing_streak: int = 0
    health_last_checked_at: str | None = None
    health_last_exit_code: int | None = None
    container_id: str | None = None
    image: str | None = None
    image_id: str | None = None
    image_created: str | None = None
    version: str | None = None
    revision: str | None = None
    build_date: str | None = None
    source: str | None = None
    oci_labels: dict[str, str] = Field(default_factory=dict)


class ExternalWatchdogAlertRunResponse(BaseModel):
    event: Literal["failure", "recovery"]
    requested_at: datetime
    run_url: str
    status: str | None = None
    conclusion: str | None = None
    checked_at: datetime | None = None
    error: str | None = None


class ManagerHttpErrorBucketResponse(BaseModel):
    started_at: datetime
    not_found_count: int = Field(default=0, ge=0)
    server_error_count: int = Field(default=0, ge=0)


class ManagerHttpErrorPathResponse(BaseModel):
    path: str
    not_found_count: int = Field(default=0, ge=0)
    server_error_count: int = Field(default=0, ge=0)
    last_seen_at: datetime


class ManagerHttpRequestLogStorageResponse(BaseModel):
    source: Literal["persistent", "docker", "unavailable"] = "unavailable"
    size_bytes: int = Field(default=0, ge=0)
    capacity_bytes: int = Field(default=0, ge=0)
    file_count: int = Field(default=0, ge=0)
    max_file_count: int = Field(default=0, ge=0)
    rotated_file_count: int = Field(default=0, ge=0)


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


class ManagerSettingsHistoryLatencyResponse(BaseModel):
    enabled: bool
    available: bool
    ready: bool
    checked_at: datetime | None = None
    last_alert_at: datetime | None = None
    alert_active: bool
    path: str
    window_minutes: int = Field(ge=1, le=1440)
    sample_count: int = Field(default=0, ge=0)
    minimum_sample_count: int = Field(default=5, ge=1)
    p95_ms: float | None = Field(default=None, ge=0)
    threshold_ms: float = Field(default=100, gt=0)


class ManagerRouteStatusResponse(BaseModel):
    available: bool
    healthy: bool
    message: str
    active_slot: str | None = None
    provider: str | None = None
    https_router_status: str | None = None
    http_router_status: str | None = None
    service_status: str | None = None
    upstream_url: str | None = None
    upstream_status: str | None = None


ManagerDeploymentStage = Literal[
    "prepare",
    "build",
    "migration_preflight",
    "candidate_health",
    "route_switch",
    "leader_handover",
    "public_probe",
    "state_write",
]


class ManagerDeploymentHistoryEntryResponse(BaseModel):
    status: Literal["success", "failed_before_switch", "rolled_back", "rollback_failed"]
    from_slot: Literal["single", "blue", "green"]
    to_slot: Literal["single", "blue", "green"]
    active_slot: Literal["single", "blue", "green", "unknown"]
    version: str
    revision: str
    started_at: datetime
    completed_at: datetime
    probe_total: int = Field(ge=0)
    probe_failures: int = Field(ge=0)
    failure_stage: ManagerDeploymentStage | None = None
    failure_reason: str | None = None
    alert_request_status: Literal["not_needed", "requested", "request_failed"] = "not_needed"
    alert_run_url: str | None = None
    alert_run_status: str | None = None
    alert_run_conclusion: str | None = None
    alert_run_checked_at: datetime | None = None
    alert_run_error: str | None = None
    stage_durations_ms: dict[ManagerDeploymentStage, int] = Field(default_factory=dict)
    archive_sample: Literal["detailed", "daily"] | None = None


class ManagerDeploymentHistoryArchiveSummaryResponse(BaseModel):
    detailed_count: int = Field(default=0, ge=0)
    daily_count: int = Field(default=0, ge=0)
    newest_at: datetime | None = None
    oldest_at: datetime | None = None


class ManagerDeploymentBottleneckEventResponse(BaseModel):
    event: Literal["alerted", "cleared"]
    occurred_at: datetime
    threshold_ms: int = Field(ge=1_000, le=900_000)
    required_consecutive_count: int = Field(ge=1, le=20)
    current_consecutive_count: int = Field(ge=0)
    latest_version: str | None = None
    slowest_stage: ManagerDeploymentStage | None = None
    slowest_ms: int = Field(default=0, ge=0)
    run_url: str | None = None


class ManagerDeploymentBottleneckAlertResponse(BaseModel):
    status: Literal[
        "not_checked",
        "no_history",
        "normal",
        "pending",
        "alerted",
        "request_failed",
    ] = "not_checked"
    configured_threshold_ms: int = Field(default=60_000, ge=1_000, le=900_000)
    configured_consecutive_count: int = Field(default=3, ge=1, le=20)
    configured_event_retention_days: int = Field(default=90, ge=1, le=3650)
    effective_threshold_ms: int = Field(default=60_000, ge=1_000, le=900_000)
    effective_consecutive_count: int = Field(default=3, ge=1, le=20)
    effective_event_retention_days: int = Field(default=90, ge=1, le=3650)
    threshold_source: Literal["settings", "environment"] = "settings"
    consecutive_source: Literal["settings", "environment"] = "settings"
    event_retention_source: Literal["settings", "environment"] = "settings"
    current_consecutive_count: int = Field(default=0, ge=0)
    checked_at: datetime | None = None
    latest_version: str | None = None
    slowest_stage: ManagerDeploymentStage | None = None
    slowest_ms: int = Field(default=0, ge=0)
    alerted_at: datetime | None = None
    run_url: str | None = None
    run_status: str | None = None
    run_conclusion: str | None = None
    run_checked_at: datetime | None = None
    run_error: str | None = None
    storage_warning_active: bool = False
    storage_warning_alerted_at: datetime | None = None
    storage_warning_run_url: str | None = None
    storage_warning_run_status: str | None = None
    storage_warning_run_conclusion: str | None = None
    storage_warning_run_checked_at: datetime | None = None
    storage_warning_run_error: str | None = None
    retained_event_count: int = Field(default=0, ge=0, le=100)
    oldest_event_at: datetime | None = None
    newest_event_at: datetime | None = None
    events: list[ManagerDeploymentBottleneckEventResponse] = Field(default_factory=list)


class DockerDeploymentInfoResponse(BaseModel):
    enabled: bool
    message: str
    version: str | None = None
    revision: str | None = None
    build_date: str | None = None
    source: str | None = None
    latest_version: str | None = None
    latest_release_url: str | None = None
    latest_version_checked_at: datetime | None = None
    latest_version_error: str | None = None
    update_available: bool | None = None
    external_watchdog_status: Literal["healthy", "unhealthy", "unknown"] = "unknown"
    external_watchdog_checked_at: datetime | None = None
    external_watchdog_consecutive_failures: int = Field(default=0, ge=0)
    external_watchdog_stale: bool = False
    external_watchdog_stale_after_minutes: int = Field(default=10, ge=5, le=1440)
    external_watchdog_last_alert_event: Literal["failure", "recovery"] | None = None
    external_watchdog_last_alert_success: bool | None = None
    external_watchdog_last_alert_at: datetime | None = None
    external_watchdog_last_alert_run_url: str | None = None
    external_watchdog_last_alert_run_status: str | None = None
    external_watchdog_last_alert_run_conclusion: str | None = None
    external_watchdog_last_alert_run_checked_at: datetime | None = None
    external_watchdog_last_alert_run_error: str | None = None
    external_watchdog_alert_runs: list[ExternalWatchdogAlertRunResponse] = Field(default_factory=list)
    http_error_summary: ManagerHttpErrorSummaryResponse | None = None
    http_error_monitor: ManagerHttpErrorMonitorResponse | None = None
    settings_history_latency_monitor: ManagerSettingsHistoryLatencyResponse | None = None
    manager_route: ManagerRouteStatusResponse | None = None
    deployment_history: list[ManagerDeploymentHistoryEntryResponse] = Field(default_factory=list)
    deployment_history_archive: list[ManagerDeploymentHistoryEntryResponse] = Field(
        default_factory=list
    )
    deployment_history_archive_summary: ManagerDeploymentHistoryArchiveSummaryResponse = Field(
        default_factory=ManagerDeploymentHistoryArchiveSummaryResponse
    )
    deployment_bottleneck_alert: ManagerDeploymentBottleneckAlertResponse = Field(
        default_factory=ManagerDeploymentBottleneckAlertResponse
    )
    components: list[DockerDeploymentComponentResponse] = Field(default_factory=list)
