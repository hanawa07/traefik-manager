from ipaddress import ip_network
from typing import Literal

from pydantic import AnyHttpUrl, BaseModel, Field, field_validator

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


def normalize_trusted_networks(value: list[str]) -> list[str]:
    normalized_networks: list[str] = []
    for item in value:
        normalized = item.strip()
        if not normalized:
            continue
        try:
            network = ip_network(normalized, strict=False)
        except ValueError as exc:
            raise ValueError("유효한 IP 또는 CIDR 대역만 입력할 수 있습니다") from exc
        normalized_networks.append(str(network))
    return normalized_networks


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


class LoginDefenseSettingsResponse(BaseModel):
    max_failed_attempts: int
    failure_window_minutes: int
    lockout_minutes: int
    suspicious_window_minutes: int
    suspicious_failure_count: int
    suspicious_username_count: int
    suspicious_block_minutes: int
    suspicious_block_enabled: bool
    suspicious_trusted_networks: list[str] = Field(default_factory=list)
    turnstile_enabled: bool = False
    turnstile_site_key: str | None = None
    turnstile_secret_key_configured: bool = False


class LoginDefenseSettingsUpdateRequest(BaseModel):
    suspicious_block_enabled: bool = True
    suspicious_trusted_networks: list[str] = Field(default_factory=list)
    turnstile_enabled: bool = False
    turnstile_site_key: str = ""
    turnstile_secret_key: str = ""

    @field_validator("suspicious_trusted_networks")
    @classmethod
    def validate_suspicious_trusted_networks(cls, value: list[str]) -> list[str]:
        return normalize_trusted_networks(value)

    @field_validator("turnstile_site_key", "turnstile_secret_key")
    @classmethod
    def normalize_turnstile_strings(cls, value: str) -> str:
        return value.strip()


class SecurityAlertSettingsResponse(BaseModel):
    enabled: bool
    provider: Literal["generic", "slack", "discord", "telegram", "teams", "pagerduty"]
    webhook_url: str | None = None
    telegram_bot_token_configured: bool = False
    telegram_chat_id: str | None = None
    pagerduty_routing_key_configured: bool = False
    timeout_seconds: float
    alert_events: list[str] = Field(default_factory=list)


class SecurityAlertSettingsUpdateRequest(BaseModel):
    enabled: bool = False
    provider: Literal["generic", "slack", "discord", "telegram", "teams", "pagerduty"] = "generic"
    webhook_url: str = ""
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    pagerduty_routing_key: str = ""

    @field_validator("webhook_url")
    @classmethod
    def validate_webhook_url(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            return ""
        return str(AnyHttpUrl(normalized))

    @field_validator("telegram_bot_token", "telegram_chat_id", "pagerduty_routing_key")
    @classmethod
    def normalize_string_fields(cls, value: str) -> str:
        return value.strip()
