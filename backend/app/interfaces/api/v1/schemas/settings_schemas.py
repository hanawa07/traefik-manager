from datetime import datetime
from email.utils import parseaddr
from ipaddress import ip_network
import re
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


class SettingsTestActionResponse(BaseModel):
    success: bool
    message: str
    detail: str | None = None
    provider: str | None = None


class SettingsRollbackActionResponse(BaseModel):
    success: bool
    message: str
    resource_name: str
    event: str


class SettingsTestHistoryItemResponse(BaseModel):
    last_event: str | None = None
    last_success: bool | None = None
    last_message: str | None = None
    last_detail: str | None = None
    last_provider: str | None = None
    last_created_at: datetime | None = None
    last_success_at: datetime | None = None
    last_failure_at: datetime | None = None
    last_failure_audit_id: str | None = None
    last_failure_message: str | None = None
    last_failure_detail: str | None = None
    last_failure_provider: str | None = None
    recent_failure_count: int = 0


class SettingsTestHistoryResponse(BaseModel):
    cloudflare: SettingsTestHistoryItemResponse
    cloudflare_reconcile: SettingsTestHistoryItemResponse
    security_alert: SettingsTestHistoryItemResponse
    security_alert_delivery: SettingsTestHistoryItemResponse
    change_alert_delivery: SettingsTestHistoryItemResponse


class CloudflareSettingsUpdateRequest(BaseModel):
    api_token: str = ""
    zone_id: str = ""
    record_target: str = ""
    proxied: bool = False


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


class CertificateDiagnosticsSettingsResponse(BaseModel):
    auto_check_interval_minutes: int
    repeat_alert_threshold: int
    repeat_alert_window_minutes: int
    repeat_alert_cooldown_minutes: int


class CertificateDiagnosticsSettingsUpdateRequest(BaseModel):
    auto_check_interval_minutes: int = Field(default=60, ge=5, le=1440)
    repeat_alert_threshold: int = Field(default=3, ge=2, le=20)
    repeat_alert_window_minutes: int = Field(default=240, ge=5, le=10080)
    repeat_alert_cooldown_minutes: int = Field(default=240, ge=5, le=10080)


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


def normalize_email_recipients(value: list[str]) -> list[str]:
    normalized_recipients: list[str] = []
    for item in value:
        normalized = item.strip()
        if not normalized:
            continue
        _, address = parseaddr(normalized)
        if not address or "@" not in address:
            raise ValueError("유효한 이메일 주소만 입력할 수 있습니다")
        normalized_recipients.append(address)
    return normalized_recipients


def normalize_email_address(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        return ""
    _, address = parseaddr(normalized)
    if not address or "@" not in address:
        raise ValueError("유효한 이메일 주소를 입력해야 합니다")
    return address


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
    suspicious_block_escalation_enabled: bool = False
    suspicious_block_escalation_window_minutes: int
    suspicious_block_escalation_multiplier: int
    suspicious_block_max_minutes: int
    turnstile_mode: Literal["off", "always", "risk_based"] = "off"
    turnstile_enabled: bool = False
    turnstile_site_key: str | None = None
    turnstile_secret_key_configured: bool = False


class LoginDefenseSettingsUpdateRequest(BaseModel):
    suspicious_block_enabled: bool = True
    suspicious_trusted_networks: list[str] = Field(default_factory=list)
    suspicious_block_escalation_enabled: bool = False
    suspicious_block_escalation_window_minutes: int = Field(default=1440, ge=1, le=10080)
    suspicious_block_escalation_multiplier: int = Field(default=2, ge=2, le=10)
    suspicious_block_max_minutes: int = Field(default=1440, ge=1, le=10080)
    turnstile_mode: Literal["off", "always", "risk_based"] = "off"
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
    change_alerts_enabled: bool = False
    provider: Literal["generic", "slack", "discord", "telegram", "teams", "pagerduty", "email"]
    webhook_url: str | None = None
    telegram_bot_token_configured: bool = False
    telegram_chat_id: str | None = None
    pagerduty_routing_key_configured: bool = False
    email_host: str | None = None
    email_port: int = 587
    email_security: Literal["none", "starttls", "ssl"] = "starttls"
    email_username: str | None = None
    email_password_configured: bool = False
    email_from: str | None = None
    email_recipients: list[str] = Field(default_factory=list)
    timeout_seconds: float
    alert_events: list[str] = Field(default_factory=list)
    event_routes: dict[str, Literal["default", "disabled", "telegram", "pagerduty", "email"]] = Field(
        default_factory=dict
    )
    change_event_routes: dict[
        str,
        Literal["default", "disabled", "telegram", "pagerduty", "email"],
    ] = Field(default_factory=dict)


class SecurityAlertSettingsUpdateRequest(BaseModel):
    enabled: bool = False
    change_alerts_enabled: bool = False
    provider: Literal["generic", "slack", "discord", "telegram", "teams", "pagerduty", "email"] = "generic"
    webhook_url: str = ""
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    pagerduty_routing_key: str = ""
    email_host: str = ""
    email_port: int = Field(default=587, ge=1, le=65535)
    email_security: Literal["none", "starttls", "ssl"] = "starttls"
    email_username: str = ""
    email_password: str = ""
    email_from: str = ""
    email_recipients: list[str] = Field(default_factory=list)
    event_routes: dict[str, Literal["default", "disabled", "telegram", "pagerduty", "email"]] = Field(
        default_factory=dict
    )
    change_event_routes: dict[
        str,
        Literal["default", "disabled", "telegram", "pagerduty", "email"],
    ] = Field(default_factory=dict)

    @field_validator("webhook_url")
    @classmethod
    def validate_webhook_url(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            return ""
        return str(AnyHttpUrl(normalized))

    @field_validator("telegram_bot_token", "telegram_chat_id", "pagerduty_routing_key", "email_host")
    @classmethod
    def normalize_string_fields(cls, value: str) -> str:
        return value.strip()

    @field_validator("email_from")
    @classmethod
    def normalize_email_from(cls, value: str) -> str:
        return normalize_email_address(value)

    @field_validator("email_recipients")
    @classmethod
    def validate_email_recipients(cls, value: list[str]) -> list[str]:
        return normalize_email_recipients(value)

    @field_validator("event_routes")
    @classmethod
    def validate_event_routes(
        cls, value: dict[str, Literal["default", "disabled", "telegram", "pagerduty", "email"]]
    ) -> dict[str, Literal["default", "disabled", "telegram", "pagerduty", "email"]]:
        allowed_events = {"login_locked", "login_suspicious", "login_blocked_ip"}
        normalized: dict[str, Literal["default", "disabled", "telegram", "pagerduty", "email"]] = {}
        for key, route in value.items():
            normalized_key = key.strip()
            if normalized_key not in allowed_events:
                raise ValueError("지원하지 않는 보안 이벤트 라우팅 키입니다")
            normalized[normalized_key] = route
        return normalized

    @field_validator("change_event_routes")
    @classmethod
    def validate_change_event_routes(
        cls, value: dict[str, Literal["default", "disabled", "telegram", "pagerduty", "email"]]
    ) -> dict[str, Literal["default", "disabled", "telegram", "pagerduty", "email"]]:
        allowed_events = {
            "settings_change",
            "service_change",
            "redirect_change",
            "middleware_change",
            "user_change",
            "certificate_status_change",
            "certificate_preflight_failure",
            "rollback",
        }
        normalized: dict[str, Literal["default", "disabled", "telegram", "pagerduty", "email"]] = {}
        for key, route in value.items():
            normalized_key = key.strip()
            if normalized_key not in allowed_events:
                raise ValueError("지원하지 않는 운영 변경 알림 라우팅 키입니다")
            normalized[normalized_key] = route
        return normalized
