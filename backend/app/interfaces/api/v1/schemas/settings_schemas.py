from pydantic import BaseModel, Field, field_validator

from app.core.time_display import get_available_timezones
from app.domain.proxy.value_objects.upstream import normalize_domain_suffixes


class CloudflareSettingsStatusResponse(BaseModel):
    enabled: bool
    configured: bool
    zone_id: str | None = None
    record_target: str | None = None
    proxied: bool
    message: str


class CloudflareSettingsUpdateRequest(BaseModel):
    api_token: str = ""
    zone_id: str = ""
    record_target: str = ""
    proxied: bool = False


class TimeDisplaySettingsResponse(BaseModel):
    display_timezone: str
    display_timezone_name: str
    display_timezone_label: str
    storage_timezone: str
    server_timezone_name: str
    server_timezone_label: str
    server_timezone_offset: str
    server_time_iso: str


class TimeDisplaySettingsUpdateRequest(BaseModel):
    display_timezone: str

    @field_validator("display_timezone")
    @classmethod
    def validate_display_timezone(cls, value: str) -> str:
        normalized = value.strip()
        if normalized not in get_available_timezones():
            raise ValueError("지원하지 않는 IANA 타임존입니다")
        return normalized


class UpstreamSecuritySettingsResponse(BaseModel):
    preset_key: str
    preset_name: str
    preset_description: str
    available_presets: list["UpstreamSecurityPresetResponse"] = Field(default_factory=list)
    dns_strict_mode: bool
    allowlist_enabled: bool = False
    allowed_domain_suffixes: list[str] = Field(default_factory=list)
    allow_docker_service_names: bool = True
    allow_private_networks: bool = True


class UpstreamSecurityPresetResponse(BaseModel):
    key: str
    name: str
    description: str
    dns_strict_mode: bool
    allowlist_enabled: bool
    allow_docker_service_names: bool
    allow_private_networks: bool


class UpstreamSecuritySettingsUpdateRequest(BaseModel):
    dns_strict_mode: bool
    allowlist_enabled: bool = False
    allowed_domain_suffixes: list[str] = Field(default_factory=list)
    allow_docker_service_names: bool = True
    allow_private_networks: bool = True

    @field_validator("allowed_domain_suffixes")
    @classmethod
    def validate_allowed_domain_suffixes(cls, value: list[str]) -> list[str]:
        return normalize_domain_suffixes(value)
