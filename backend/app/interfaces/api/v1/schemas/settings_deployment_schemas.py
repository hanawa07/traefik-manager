from pydantic import BaseModel, Field

from app.infrastructure.manager_deployment_bottleneck import (
    DEFAULT_CONSECUTIVE_COUNT,
    DEFAULT_EVENT_RETENTION_DAYS,
    DEFAULT_THRESHOLD_MS,
    MAX_CONSECUTIVE_COUNT,
    MAX_EVENT_RETENTION_DAYS,
    MAX_THRESHOLD_MS,
    MIN_CONSECUTIVE_COUNT,
    MIN_EVENT_RETENTION_DAYS,
    MIN_THRESHOLD_MS,
)


class ManagerDeploymentBottleneckSettingsResponse(BaseModel):
    threshold_ms: int = Field(
        default=DEFAULT_THRESHOLD_MS,
        ge=MIN_THRESHOLD_MS,
        le=MAX_THRESHOLD_MS,
    )
    consecutive_count: int = Field(
        default=DEFAULT_CONSECUTIVE_COUNT,
        ge=MIN_CONSECUTIVE_COUNT,
        le=MAX_CONSECUTIVE_COUNT,
    )
    event_retention_days: int = Field(
        default=DEFAULT_EVENT_RETENTION_DAYS,
        ge=MIN_EVENT_RETENTION_DAYS,
        le=MAX_EVENT_RETENTION_DAYS,
    )


class ManagerDeploymentBottleneckSettingsUpdateRequest(
    ManagerDeploymentBottleneckSettingsResponse
):
    event_retention_days: int | None = Field(
        default=None,
        ge=MIN_EVENT_RETENTION_DAYS,
        le=MAX_EVENT_RETENTION_DAYS,
    )
