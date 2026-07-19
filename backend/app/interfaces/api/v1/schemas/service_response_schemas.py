from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ServiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    domain: str
    upstream_host: str
    upstream_port: int
    routing_mode: str
    upstream_scheme: str
    skip_tls_verify: bool
    tls_enabled: bool
    https_redirect_enabled: bool
    auth_enabled: bool
    auth_mode: str
    api_key: str | None = None
    allowed_ips: list[str]
    blocked_paths: list[str]
    rate_limit_enabled: bool
    rate_limit_average: int | None = None
    rate_limit_burst: int | None = None
    custom_headers: dict[str, str]
    frame_policy: str
    healthcheck_enabled: bool
    healthcheck_path: str
    healthcheck_timeout_ms: int
    healthcheck_expected_statuses: list[int]
    basic_auth_enabled: bool
    basic_auth_user_count: int
    basic_auth_usernames: list[str]
    middleware_template_ids: list[str]
    authentik_group_id: str | None = None
    authentik_group_name: str | None = None
    cloudflare_record_id: str | None = None
    created_at: datetime
    updated_at: datetime

    @field_validator("id", mode="before")
    @classmethod
    def normalize_id(cls, value):
        if isinstance(value, UUID):
            return value
        inner_value = getattr(value, "value", None)
        if isinstance(inner_value, UUID):
            return inner_value
        return value

    @field_validator("domain", mode="before")
    @classmethod
    def normalize_domain(cls, value):
        inner_value = getattr(value, "value", None)
        if isinstance(inner_value, str):
            return inner_value
        return value


class AuthentikGroupResponse(BaseModel):
    id: str
    name: str


class UpstreamHealthResponse(BaseModel):
    service_id: UUID
    domain: str
    status: str  # "up" | "down" | "unknown"
    status_code: int | None = None
    latency_ms: int | None = None
    error: str | None = None
    error_kind: str | None = None
    checked_url: str
    checked_at: datetime


class ServiceGatewayDiagnosticCheckResponse(BaseModel):
    key: str
    label: str
    status: str  # "ok" | "warning" | "fail"
    message: str
    details: dict = Field(default_factory=dict)


class ServiceGatewayDiagnosisResponse(BaseModel):
    service_id: UUID
    domain: str
    status: str  # "ok" | "warning" | "fail"
    summary: str
    checked_at: datetime
    checks: list[ServiceGatewayDiagnosticCheckResponse]


class ServiceGatewayNetworkConnectResponse(BaseModel):
    service_id: UUID
    domain: str
    upstream_host: str
    network: str
    status: str  # "connected" | "already_connected"
    message: str
    upstream_networks: list[str]
    checked_at: datetime
