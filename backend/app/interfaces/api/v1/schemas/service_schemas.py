from pydantic import BaseModel, field_validator
from uuid import UUID
from datetime import datetime
import re


class ServiceCreate(BaseModel):
    name: str
    domain: str
    upstream_host: str
    upstream_port: int
    tls_enabled: bool = True
    auth_enabled: bool = False

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


class ServiceUpdate(BaseModel):
    name: str | None = None
    upstream_host: str | None = None
    upstream_port: int | None = None
    tls_enabled: bool | None = None
    auth_enabled: bool | None = None


class ServiceResponse(BaseModel):
    id: UUID
    name: str
    domain: str
    upstream_host: str
    upstream_port: int
    tls_enabled: bool
    auth_enabled: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
