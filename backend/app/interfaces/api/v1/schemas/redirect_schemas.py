import re
from datetime import datetime
from urllib.parse import urlparse
from uuid import UUID

from pydantic import BaseModel, field_validator


class RedirectHostCreate(BaseModel):
    domain: str
    target_url: str
    permanent: bool = True
    tls_enabled: bool = True

    @field_validator("domain")
    @classmethod
    def validate_domain(cls, value: str) -> str:
        pattern = r"^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$"
        if not re.match(pattern, value):
            raise ValueError("유효하지 않은 도메인 형식입니다")
        return value

    @field_validator("target_url")
    @classmethod
    def validate_target_url(cls, value: str) -> str:
        target = value.strip()
        if not target:
            raise ValueError("리다이렉트 대상 URL은 필수입니다")
        parsed = urlparse(target)
        if parsed.scheme and parsed.scheme not in ("http", "https"):
            raise ValueError("리다이렉트 대상 URL은 http 또는 https만 지원합니다")
        return target


class RedirectHostUpdate(BaseModel):
    domain: str | None = None
    target_url: str | None = None
    permanent: bool | None = None
    tls_enabled: bool | None = None

    @field_validator("domain")
    @classmethod
    def validate_domain(cls, value: str | None) -> str | None:
        if value is None:
            return None
        pattern = r"^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$"
        if not re.match(pattern, value):
            raise ValueError("유효하지 않은 도메인 형식입니다")
        return value

    @field_validator("target_url")
    @classmethod
    def validate_target_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        target = value.strip()
        if not target:
            raise ValueError("리다이렉트 대상 URL은 필수입니다")
        parsed = urlparse(target)
        if parsed.scheme and parsed.scheme not in ("http", "https"):
            raise ValueError("리다이렉트 대상 URL은 http 또는 https만 지원합니다")
        return target


class RedirectHostResponse(BaseModel):
    id: UUID
    domain: str
    target_url: str
    permanent: bool
    tls_enabled: bool
    created_at: datetime
    updated_at: datetime

    @field_validator("domain", mode="before")
    @classmethod
    def normalize_domain(cls, value):
        inner_value = getattr(value, "value", None)
        if isinstance(inner_value, str):
            return inner_value
        return value

    class Config:
        from_attributes = True
