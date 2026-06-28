from ipaddress import ip_network
from typing import Literal

from pydantic import BaseModel, Field, field_validator


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
