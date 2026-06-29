from pydantic import BaseModel, Field, field_validator, model_validator

from app.interfaces.api.v1.schemas.service_basic_auth_schemas import BasicAuthCredential
from app.interfaces.api.v1.schemas.service_schema_validators import (
    DEFAULT_HEALTHCHECK_PATH,
    DEFAULT_HEALTHCHECK_TIMEOUT_MS,
    normalize_authentik_group_id as _normalize_authentik_group_id,
    normalize_allowed_ips as _normalize_allowed_ips,
    normalize_custom_headers as _normalize_custom_headers,
    normalize_healthcheck_expected_statuses as _normalize_healthcheck_expected_statuses,
    normalize_healthcheck_path as _normalize_healthcheck_path,
    normalize_middleware_template_ids as _normalize_middleware_template_ids,
    normalize_optional_allowed_ips as _normalize_optional_allowed_ips,
    normalize_optional_custom_headers as _normalize_optional_custom_headers,
    normalize_optional_healthcheck_expected_statuses as _normalize_optional_healthcheck_expected_statuses,
    normalize_optional_healthcheck_path as _normalize_optional_healthcheck_path,
    normalize_optional_middleware_template_ids as _normalize_optional_middleware_template_ids,
    validate_auth_mode as _validate_auth_mode,
    validate_blocked_paths as _validate_blocked_paths,
    validate_domain as _validate_domain,
    validate_frame_policy as _validate_frame_policy,
    validate_healthcheck_timeout_ms as _validate_healthcheck_timeout_ms,
    validate_optional_auth_mode as _validate_optional_auth_mode,
    validate_optional_frame_policy as _validate_optional_frame_policy,
    validate_optional_healthcheck_timeout_ms as _validate_optional_healthcheck_timeout_ms,
    validate_optional_upstream_scheme as _validate_optional_upstream_scheme,
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
        # auth_enabled legacy support
        if self.auth_mode == "none" and self.auth_enabled is True:
            self.auth_mode = "authentik"

        if self.https_redirect_enabled and not self.tls_enabled:
            raise ValueError("HTTPS 리다이렉트는 TLS 활성화 시에만 사용할 수 있습니다")

        if self.auth_mode != "authentik" and self.authentik_group_id:
            raise ValueError("Authentik 인증 모드에서만 Authentik 그룹을 설정할 수 없습니다")

        if self.auth_mode != "none" and self.basic_auth_enabled:
            raise ValueError("인증 모드와 Basic Auth는 동시에 설정할 수 없습니다")

        if self.basic_auth_enabled and not self.basic_auth_credentials:
            raise ValueError("Basic Auth를 활성화하려면 사용자 이름과 비밀번호를 입력해야 합니다")
        if not self.basic_auth_enabled and self.basic_auth_credentials:
            raise ValueError("Basic Auth 비활성화 상태에서는 사용자 정보를 함께 보낼 수 없습니다")
        if (self.rate_limit_average is None) ^ (self.rate_limit_burst is None):
            raise ValueError("Rate Limit을 활성화하려면 average와 burst를 모두 입력해야 합니다")
        return self


class ServiceUpdate(BaseModel):
    name: str | None = None
    upstream_host: str | None = None
    upstream_port: int | None = None
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
        # auth_enabled legacy support
        if self.auth_mode is None and self.auth_enabled is not None:
            self.auth_mode = "authentik" if self.auth_enabled else "none"

        if self.https_redirect_enabled and self.tls_enabled is False:
            raise ValueError("HTTPS 리다이렉트는 TLS 활성화 시에만 사용할 수 있습니다")

        current_auth_mode = self.auth_mode
        # Note: In update, we might not have all fields.
        # But we check what we have.

        if current_auth_mode is not None:
            if current_auth_mode != "authentik" and self.authentik_group_id:
                raise ValueError("Authentik 인증 모드에서만 Authentik 그룹을 설정할 수 없습니다")
            if current_auth_mode != "none" and self.basic_auth_enabled is True:
                raise ValueError("인증 모드와 Basic Auth는 동시에 설정할 수 없습니다")

        if self.basic_auth_enabled is False and self.basic_auth_credentials:
            raise ValueError("Basic Auth 비활성화 상태에서는 사용자 정보를 함께 보낼 수 없습니다")
        if self.basic_auth_enabled is True and self.basic_auth_credentials is not None and not self.basic_auth_credentials:
            raise ValueError("Basic Auth를 활성화하려면 사용자 이름과 비밀번호를 입력해야 합니다")
        if self.rate_limit_enabled is True:
            if self.rate_limit_average is None or self.rate_limit_burst is None:
                raise ValueError("Rate Limit을 활성화하려면 average와 burst를 모두 입력해야 합니다")
        if self.rate_limit_enabled is False:
            if self.rate_limit_average is not None or self.rate_limit_burst is not None:
                raise ValueError("Rate Limit 비활성화 시 값을 함께 보낼 수 없습니다")
        return self
