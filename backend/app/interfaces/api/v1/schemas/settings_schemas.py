from pydantic import BaseModel, field_validator

from app.core.time_display import get_available_timezones


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
