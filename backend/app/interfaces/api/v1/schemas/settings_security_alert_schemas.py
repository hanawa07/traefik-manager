from email.utils import parseaddr
from typing import Literal

from pydantic import AnyHttpUrl, BaseModel, Field, field_validator


SecurityAlertRoute = Literal["default", "disabled", "telegram", "pagerduty", "email"]


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
    event_routes: dict[str, SecurityAlertRoute] = Field(default_factory=dict)
    change_event_routes: dict[str, SecurityAlertRoute] = Field(default_factory=dict)


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
    event_routes: dict[str, SecurityAlertRoute] = Field(default_factory=dict)
    change_event_routes: dict[str, SecurityAlertRoute] = Field(default_factory=dict)

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
        cls, value: dict[str, SecurityAlertRoute]
    ) -> dict[str, SecurityAlertRoute]:
        allowed_events = {"login_locked", "login_suspicious", "login_blocked_ip"}
        normalized: dict[str, SecurityAlertRoute] = {}
        for key, route in value.items():
            normalized_key = key.strip()
            if normalized_key not in allowed_events:
                raise ValueError("지원하지 않는 보안 이벤트 라우팅 키입니다")
            normalized[normalized_key] = route
        return normalized

    @field_validator("change_event_routes")
    @classmethod
    def validate_change_event_routes(
        cls, value: dict[str, SecurityAlertRoute]
    ) -> dict[str, SecurityAlertRoute]:
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
        normalized: dict[str, SecurityAlertRoute] = {}
        for key, route in value.items():
            normalized_key = key.strip()
            if normalized_key not in allowed_events:
                raise ValueError("지원하지 않는 운영 변경 알림 라우팅 키입니다")
            normalized[normalized_key] = route
        return normalized
