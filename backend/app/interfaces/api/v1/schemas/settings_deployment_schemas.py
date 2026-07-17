from pydantic import BaseModel, Field

from app.infrastructure.manager_deployment_bottleneck import (
    DEFAULT_CONSECUTIVE_COUNT,
    DEFAULT_THRESHOLD_MS,
    MAX_CONSECUTIVE_COUNT,
    MAX_THRESHOLD_MS,
    MIN_CONSECUTIVE_COUNT,
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


class ManagerDeploymentBottleneckSettingsUpdateRequest(
    ManagerDeploymentBottleneckSettingsResponse
):
    pass
