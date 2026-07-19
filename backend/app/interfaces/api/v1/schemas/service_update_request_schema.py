from typing import Literal

from pydantic import AwareDatetime, BaseModel, Field, field_validator, model_validator

from app.interfaces.api.v1.schemas.service_basic_auth_schemas import BasicAuthCredential
from app.interfaces.api.v1.schemas.service_request_cross_validators import validate_service_update_cross_fields
from app.interfaces.api.v1.schemas.service_schema_validators import (
    normalize_authentik_group_id as _normalize_authentik_group_id,
    normalize_optional_allowed_ips as _normalize_optional_allowed_ips,
    normalize_optional_custom_headers as _normalize_optional_custom_headers,
    normalize_optional_healthcheck_expected_statuses as _normalize_optional_healthcheck_expected_statuses,
    normalize_optional_healthcheck_path as _normalize_optional_healthcheck_path,
    normalize_optional_middleware_template_ids as _normalize_optional_middleware_template_ids,
    validate_optional_auth_mode as _validate_optional_auth_mode,
    validate_optional_frame_policy as _validate_optional_frame_policy,
    validate_optional_healthcheck_timeout_ms as _validate_optional_healthcheck_timeout_ms,
    validate_optional_upstream_scheme as _validate_optional_upstream_scheme,
    validate_rate_limit_value as _validate_rate_limit_value,
)


class ServiceUpdate(BaseModel):
    name: str | None = None
    upstream_host: str | None = None
    upstream_port: int | None = None
    routing_mode: Literal["active", "disabled", "maintenance"] | None = None
    maintenance_message: str | None = Field(default=None, max_length=300)
    maintenance_until: AwareDatetime | None = None
    upstream_scheme: str | None = None
    skip_tls_verify: bool | None = None
    tls_enabled: bool | None = None
    https_redirect_enabled: bool | None = None
    auth_enabled: bool | None = None  # legacy
    auth_mode: str | None = None
    api_key: str | None = None
    basic_auth_enabled: bool | None = None
    allowed_ips: list[str] | None = None
    blocked_paths: list[str] | None = None
    middleware_template_ids: list[str] | None = None
    rate_limit_enabled: bool | None = None
    rate_limit_average: int | None = None
    rate_limit_burst: int | None = None
    custom_headers: dict[str, str] | None = None
    frame_policy: str | None = None
    healthcheck_enabled: bool | None = None
    healthcheck_path: str | None = None
    healthcheck_timeout_ms: int | None = None
    healthcheck_expected_statuses: list[int] | None = None
    basic_auth_credentials: list[BasicAuthCredential] | None = None
    authentik_group_id: str | None = None

    @field_validator("auth_mode")
    @classmethod
    def validate_auth_mode(cls, v: str | None) -> str | None:
        return _validate_optional_auth_mode(v)

    @field_validator("upstream_scheme")
    @classmethod
    def validate_upstream_scheme(cls, v: str | None) -> str | None:
        return _validate_optional_upstream_scheme(v)

    @field_validator("frame_policy")
    @classmethod
    def validate_frame_policy(cls, v: str | None) -> str | None:
        return _validate_optional_frame_policy(v)

    @field_validator("healthcheck_path")
    @classmethod
    def validate_healthcheck_path(cls, v: str | None) -> str | None:
        return _normalize_optional_healthcheck_path(v)

    @field_validator("healthcheck_timeout_ms")
    @classmethod
    def validate_healthcheck_timeout_ms(cls, v: int | None) -> int | None:
        return _validate_optional_healthcheck_timeout_ms(v)

    @field_validator("healthcheck_expected_statuses")
    @classmethod
    def validate_healthcheck_expected_statuses(cls, values: list[int] | None) -> list[int] | None:
        return _normalize_optional_healthcheck_expected_statuses(values)

    @field_validator("allowed_ips")
    @classmethod
    def validate_allowed_ips(cls, values: list[str] | None) -> list[str] | None:
        return _normalize_optional_allowed_ips(values)

    @field_validator("authentik_group_id")
    @classmethod
    def normalize_authentik_group_id(cls, value: str | None) -> str | None:
        return _normalize_authentik_group_id(value)

    @field_validator("middleware_template_ids")
    @classmethod
    def normalize_middleware_template_ids(cls, values: list[str] | None) -> list[str] | None:
        return _normalize_optional_middleware_template_ids(values)

    @field_validator("rate_limit_average", "rate_limit_burst")
    @classmethod
    def validate_rate_limit_values(cls, value: int | None) -> int | None:
        return _validate_rate_limit_value(value)

    @field_validator("custom_headers")
    @classmethod
    def validate_custom_headers(
        cls,
        values: dict[str, str] | None,
    ) -> dict[str, str] | None:
        return _normalize_optional_custom_headers(values)

    @model_validator(mode="after")
    def validate_cross_fields(self):
        return validate_service_update_cross_fields(self)
