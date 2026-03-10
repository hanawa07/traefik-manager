from ipaddress import ip_network
import re
from pydantic import BaseModel, Field, field_validator, model_validator
from uuid import UUID
from datetime import datetime

AUTH_MODE_VALUES = {"none", "authentik", "token"}
FRAME_POLICY_VALUES = {"deny", "sameorigin", "off"}


class BasicAuthCredential(BaseModel):
    username: str
    password: str = ""

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Basic Auth 사용자 이름을 입력하세요")
        if ":" in value:
            raise ValueError("Basic Auth 사용자 이름에는 ':' 문자를 사용할 수 없습니다")
        if "\n" in value or "\r" in value:
            raise ValueError("유효하지 않은 Basic Auth 사용자 이름입니다")
        return value

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if value and ("\n" in value or "\r" in value):
            raise ValueError("유효하지 않은 Basic Auth 비밀번호입니다")
        return value


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
    basic_auth_credentials: list[BasicAuthCredential] = Field(default_factory=list)
    authentik_group_id: str | None = None

    @field_validator("auth_mode")
    @classmethod
    def validate_auth_mode(cls, v: str) -> str:
        if v not in AUTH_MODE_VALUES:
            raise ValueError(f"auth_mode는 {AUTH_MODE_VALUES} 중 하나여야 합니다")
        return v

    @field_validator("upstream_scheme")
    @classmethod
    def validate_upstream_scheme(cls, v: str) -> str:
        if v not in ["http", "https"]:
            raise ValueError("업스트림 스킴은 http 또는 https여야 합니다")
        return v

    @field_validator("frame_policy")
    @classmethod
    def validate_frame_policy(cls, v: str) -> str:
        if v not in FRAME_POLICY_VALUES:
            raise ValueError(f"frame_policy는 {FRAME_POLICY_VALUES} 중 하나여야 합니다")
        return v

    @field_validator("domain")
    @classmethod
    def validate_domain(cls, v: str) -> str:
        pattern = r"^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$"
        if not re.match(pattern, v):
            raise ValueError("유효하지 않은 도메인 형식입니다")
        return v

    @field_validator("upstream_port")
    @classmethod
    def validate_port(cls, v: int) -> int:
        if not (1 <= v <= 65535):
            raise ValueError("포트는 1~65535 범위여야 합니다")
        return v

    @field_validator("allowed_ips")
    @classmethod
    def validate_allowed_ips(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for raw_ip in values:
            value = raw_ip.strip()
            if not value:
                continue
            cidr = str(ip_network(value, strict=False))
            if cidr not in seen:
                seen.add(cidr)
                normalized.append(cidr)
        return normalized

    @field_validator("blocked_paths")
    @classmethod
    def validate_blocked_paths(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return None
        for path in v:
            if not path.startswith("/"):
                raise ValueError(f"차단 경로는 '/'로 시작해야 합니다: {path}")
        return v

    @field_validator("authentik_group_id")
    @classmethod
    def normalize_authentik_group_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None

    @field_validator("middleware_template_ids")
    @classmethod
    def normalize_middleware_template_ids(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for raw_id in values:
            value = str(raw_id).strip()
            if not value:
                continue
            if value not in seen:
                seen.add(value)
                normalized.append(value)
        return normalized

    @field_validator("rate_limit_average", "rate_limit_burst")
    @classmethod
    def validate_rate_limit_values(cls, value: int | None) -> int | None:
        if value is None:
            return None
        if value <= 0:
            raise ValueError("Rate Limit 값은 1 이상의 정수여야 합니다")
        return value

    @field_validator("custom_headers")
    @classmethod
    def validate_custom_headers(cls, values: dict[str, str]) -> dict[str, str]:
        normalized: dict[str, str] = {}
        token_pattern = re.compile(r"^[A-Za-z0-9-]+$")

        for raw_key, raw_value in values.items():
            key = raw_key.strip()
            value = raw_value.strip()
            if not key:
                continue
            if not token_pattern.match(key):
                raise ValueError(f"유효하지 않은 헤더 키입니다: {key}")
            if "\n" in key or "\r" in key or "\n" in value or "\r" in value:
                raise ValueError(f"유효하지 않은 헤더 값입니다: {key}")
            normalized[key] = value

        return normalized

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
    basic_auth_credentials: list[BasicAuthCredential] | None = None
    authentik_group_id: str | None = None

    @field_validator("auth_mode")
    @classmethod
    def validate_auth_mode(cls, v: str | None) -> str | None:
        if v is not None and v not in AUTH_MODE_VALUES:
            raise ValueError(f"auth_mode는 {AUTH_MODE_VALUES} 중 하나여야 합니다")
        return v

    @field_validator("upstream_scheme")
    @classmethod
    def validate_upstream_scheme(cls, v: str | None) -> str | None:
        if v is not None and v not in ["http", "https"]:
            raise ValueError("업스트림 스킴은 http 또는 https여야 합니다")
        return v

    @field_validator("frame_policy")
    @classmethod
    def validate_frame_policy(cls, v: str | None) -> str | None:
        if v is not None and v not in FRAME_POLICY_VALUES:
            raise ValueError(f"frame_policy는 {FRAME_POLICY_VALUES} 중 하나여야 합니다")
        return v

    @field_validator("allowed_ips")
    @classmethod
    def validate_allowed_ips(cls, values: list[str] | None) -> list[str] | None:
        if values is None:
            return None
        normalized: list[str] = []
        seen: set[str] = set()
        for raw_ip in values:
            value = raw_ip.strip()
            if not value:
                continue
            cidr = str(ip_network(value, strict=False))
            if cidr not in seen:
                seen.add(cidr)
                normalized.append(cidr)
        return normalized

    @field_validator("authentik_group_id")
    @classmethod
    def normalize_authentik_group_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None

    @field_validator("middleware_template_ids")
    @classmethod
    def normalize_middleware_template_ids(cls, values: list[str] | None) -> list[str] | None:
        if values is None:
            return None
        normalized: list[str] = []
        seen: set[str] = set()
        for raw_id in values:
            value = str(raw_id).strip()
            if not value:
                continue
            if value not in seen:
                seen.add(value)
                normalized.append(value)
        return normalized

    @field_validator("rate_limit_average", "rate_limit_burst")
    @classmethod
    def validate_rate_limit_values(cls, value: int | None) -> int | None:
        if value is None:
            return None
        if value <= 0:
            raise ValueError("Rate Limit 값은 1 이상의 정수여야 합니다")
        return value

    @field_validator("custom_headers")
    @classmethod
    def validate_custom_headers(
        cls,
        values: dict[str, str] | None,
    ) -> dict[str, str] | None:
        if values is None:
            return None

        normalized: dict[str, str] = {}
        token_pattern = re.compile(r"^[A-Za-z0-9-]+$")
        for raw_key, raw_value in values.items():
            key = raw_key.strip()
            value = raw_value.strip()
            if not key:
                continue
            if not token_pattern.match(key):
                raise ValueError(f"유효하지 않은 헤더 키입니다: {key}")
            if "\n" in key or "\r" in key or "\n" in value or "\r" in value:
                raise ValueError(f"유효하지 않은 헤더 값입니다: {key}")
            normalized[key] = value
        return normalized

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


class ServiceResponse(BaseModel):
    id: UUID
    name: str
    domain: str
    upstream_host: str
    upstream_port: int
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

    class Config:
        from_attributes = True


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
