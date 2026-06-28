import re

from pydantic import BaseModel, field_validator


class TraefikDashboardSettingsResponse(BaseModel):
    enabled: bool
    configured: bool
    domain: str | None = None
    public_url: str | None = None
    auth_username: str | None = None
    auth_password_configured: bool = False
    message: str


class TraefikDashboardSettingsUpdateRequest(BaseModel):
    enabled: bool = False
    domain: str = ""
    auth_username: str = ""
    auth_password: str = ""

    @field_validator("domain")
    @classmethod
    def validate_domain(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not normalized:
            return ""
        if "://" in normalized or "/" in normalized:
            raise ValueError("https:// 없이 공개 도메인만 입력해야 합니다")
        pattern = r"^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$"
        if not re.match(pattern, normalized):
            raise ValueError("유효한 공개 도메인을 입력해야 합니다")
        return normalized

    @field_validator("auth_username", "auth_password")
    @classmethod
    def normalize_dashboard_auth_fields(cls, value: str) -> str:
        normalized = value.strip()
        return normalized

    @field_validator("auth_username")
    @classmethod
    def validate_dashboard_auth_username(cls, value: str) -> str:
        if value and ":" in value:
            raise ValueError("기본 인증 사용자명에는 ':' 문자를 사용할 수 없습니다")
        return value
