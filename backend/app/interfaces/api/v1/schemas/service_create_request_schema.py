from pydantic import BaseModel, Field, field_validator, model_validator

from app.interfaces.api.v1.schemas.service_basic_auth_schemas import BasicAuthCredential
from app.interfaces.api.v1.schemas.service_request_cross_validators import validate_service_create_cross_fields
from app.interfaces.api.v1.schemas.service_schema_validators import (
    DEFAULT_HEALTHCHECK_PATH,
    DEFAULT_HEALTHCHECK_TIMEOUT_MS,
    normalize_authentik_group_id as _normalize_authentik_group_id,
    normalize_allowed_ips as _normalize_allowed_ips,
    normalize_custom_headers as _normalize_custom_headers,
    normalize_healthcheck_expected_statuses as _normalize_healthcheck_expected_statuses,
    normalize_healthcheck_path as _normalize_healthcheck_path,
    normalize_middleware_template_ids as _normalize_middleware_template_ids,
    validate_auth_mode as _validate_auth_mode,
    validate_blocked_paths as _validate_blocked_paths,
    validate_domain as _validate_domain,
    validate_frame_policy as _validate_frame_policy,
    validate_healthcheck_timeout_ms as _validate_healthcheck_timeout_ms,
    validate_port as _validate_port,
    validate_rate_limit_value as _validate_rate_limit_value,
    validate_upstream_scheme as _validate_upstream_scheme,
)


class ServiceCreate(BaseModel):
    name: str
    domain: str
    upstream_host: str
    upstream_port: int
    upstream_scheme: str = "http"
    skip_tls_verify: bool = False
    tls_enabled: bool = True
    https_redirect_enabled: bool = True
    auth_enabled: bool | None = None  # legacy
    auth_mode: str = "none"
    api_key: str | None = None
    basic_auth_enabled: bool = False
    allowed_ips: list[str] = Field(default_factory=list)
    blocked_paths: list[str] = Field(default_factory=list)
    middleware_template_ids: list[str] = Field(default_factory=list)
    rate_limit_average: int | None = None
    rate_limit_burst: int | None = None
    custom_headers: dict[str, str] = Field(default_factory=dict)
    frame_policy: str = "deny"
    healthcheck_enabled: bool = True
    healthcheck_path: str = DEFAULT_HEALTHCHECK_PATH
    healthcheck_timeout_ms: int = DEFAULT_HEALTHCHECK_TIMEOUT_MS
    healthcheck_expected_statuses: list[int] = Field(default_factory=list)
    basic_auth_credentials: list[BasicAuthCredential] = Field(default_factory=list)
    authentik_group_id: str | None = None

    @field_validator("auth_mode")
    @classmethod
    def validate_auth_mode(cls, v: str) -> str:
        return _validate_auth_mode(v)

    @field_validator("upstream_scheme")
    @classmethod
    def validate_upstream_scheme(cls, v: str) -> str:
        return _validate_upstream_scheme(v)

    @field_validator("frame_policy")
    @classmethod
    def validate_frame_policy(cls, v: str) -> str:
        return _validate_frame_policy(v)

    @field_validator("healthcheck_path")
    @classmethod
    def validate_healthcheck_path(cls, v: str) -> str:
        return _normalize_healthcheck_path(v)

    @field_validator("healthcheck_timeout_ms")
    @classmethod
    def validate_healthcheck_timeout_ms(cls, v: int) -> int:
        return _validate_healthcheck_timeout_ms(v)

    @field_validator("healthcheck_expected_statuses")
    @classmethod
    def validate_healthcheck_expected_statuses(cls, values: list[int]) -> list[int]:
        return _normalize_healthcheck_expected_statuses(values)

    @field_validator("domain")
    @classmethod
    def validate_domain(cls, v: str) -> str:
        return _validate_domain(v)

    @field_validator("upstream_port")
    @classmethod
    def validate_port(cls, v: int) -> int:
        return _validate_port(v)

    @field_validator("allowed_ips")
    @classmethod
    def validate_allowed_ips(cls, values: list[str]) -> list[str]:
        return _normalize_allowed_ips(values)

    @field_validator("blocked_paths")
    @classmethod
    def validate_blocked_paths(cls, v: list[str] | None) -> list[str] | None:
        return _validate_blocked_paths(v)

    @field_validator("authentik_group_id")
    @classmethod
    def normalize_authentik_group_id(cls, value: str | None) -> str | None:
        return _normalize_authentik_group_id(value)

    @field_validator("middleware_template_ids")
    @classmethod
    def normalize_middleware_template_ids(cls, values: list[str]) -> list[str]:
        return _normalize_middleware_template_ids(values)

    @field_validator("rate_limit_average", "rate_limit_burst")
    @classmethod
    def validate_rate_limit_values(cls, value: int | None) -> int | None:
        return _validate_rate_limit_value(value)

    @field_validator("custom_headers")
    @classmethod
    def validate_custom_headers(cls, values: dict[str, str]) -> dict[str, str]:
        return _normalize_custom_headers(values)

    @model_validator(mode="after")
    def validate_cross_fields(self):
        return validate_service_create_cross_fields(self)
