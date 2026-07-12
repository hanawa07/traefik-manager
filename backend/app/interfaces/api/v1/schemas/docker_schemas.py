from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


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
    components: list[DockerDeploymentComponentResponse] = Field(default_factory=list)
