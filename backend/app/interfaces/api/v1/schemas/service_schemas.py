from ipaddress import ip_network
from pydantic import BaseModel, Field, field_validator, model_validator
from uuid import UUID
from datetime import datetime
import re


class ServiceCreate(BaseModel):
    name: str
    domain: str
    upstream_host: str
    upstream_port: int
    tls_enabled: bool = True
    https_redirect_enabled: bool = True
    auth_enabled: bool = False
    allowed_ips: list[str] = Field(default_factory=list)
    authentik_group_id: str | None = None

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

    @field_validator("authentik_group_id")
    @classmethod
    def normalize_authentik_group_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None

    @model_validator(mode="after")
    def validate_cross_fields(self):
        if self.https_redirect_enabled and not self.tls_enabled:
            raise ValueError("HTTPS 리다이렉트는 TLS 활성화 시에만 사용할 수 있습니다")
        if not self.auth_enabled and self.authentik_group_id:
            raise ValueError("인증이 비활성화된 서비스에는 Authentik 그룹을 설정할 수 없습니다")
        return self


class ServiceUpdate(BaseModel):
    name: str | None = None
    upstream_host: str | None = None
    upstream_port: int | None = None
    tls_enabled: bool | None = None
    https_redirect_enabled: bool | None = None
    auth_enabled: bool | None = None
    allowed_ips: list[str] | None = None
    authentik_group_id: str | None = None

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

    @model_validator(mode="after")
    def validate_cross_fields(self):
        if self.https_redirect_enabled and self.tls_enabled is False:
            raise ValueError("HTTPS 리다이렉트는 TLS 활성화 시에만 사용할 수 있습니다")
        if self.auth_enabled is False and self.authentik_group_id:
            raise ValueError("인증이 비활성화된 서비스에는 Authentik 그룹을 설정할 수 없습니다")
        return self


class ServiceResponse(BaseModel):
    id: UUID
    name: str
    domain: str
    upstream_host: str
    upstream_port: int
    tls_enabled: bool
    https_redirect_enabled: bool
    auth_enabled: bool
    allowed_ips: list[str]
    authentik_group_id: str | None = None
    authentik_group_name: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AuthentikGroupResponse(BaseModel):
    id: str
    name: str
