from datetime import datetime

from pydantic import BaseModel, Field


class TraefikHealthResponse(BaseModel):
    connected: bool
    message: str
    version: str | None = None
    latest_version: str | None = None
    latest_release_url: str | None = None
    update_available: bool | None = None
    latest_version_checked_at: datetime | None = None
    latest_version_error: str | None = None


class TraefikDeploymentCheckResponse(BaseModel):
    key: str
    label: str
    status: str
    message: str


class TraefikDeploymentCommandResponse(BaseModel):
    label: str
    description: str
    command: str


class TraefikDeploymentStatusResponse(BaseModel):
    enabled: bool
    message: str
    container_name: str | None = None
    current_image: str | None = None
    target_image: str | None = None
    current_version: str | None = None
    target_version: str | None = None
    update_available: bool | None = None
    compose_project: str | None = None
    compose_service: str | None = None
    compose_working_dir: str | None = None
    compose_config_files: list[str] = Field(default_factory=list)
    can_apply: bool
    apply_blocked_reason: str | None = None
    checks: list[TraefikDeploymentCheckResponse] = Field(default_factory=list)
    commands: list[TraefikDeploymentCommandResponse] = Field(default_factory=list)


class TraefikRouterItemResponse(BaseModel):
    name: str
    status: str
    rule: str


class TraefikDomainRouterStatusResponse(BaseModel):
    active: bool
    routers: list[TraefikRouterItemResponse] = Field(default_factory=list)


class TraefikRouterStatusResponse(BaseModel):
    connected: bool
    message: str
    domains: dict[str, TraefikDomainRouterStatusResponse] = Field(default_factory=dict)


class TraefikMiddlewareItemResponse(BaseModel):
    name: str
    provider: str | None = None
    status: str
    type: str
    used_by: list[str] = Field(default_factory=list)
    config: dict = Field(default_factory=dict)


class TraefikMiddlewareListResponse(BaseModel):
    connected: bool
    message: str
    middlewares: list[TraefikMiddlewareItemResponse] = Field(default_factory=list)
