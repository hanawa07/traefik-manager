from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class CertificateResponse(BaseModel):
    domain: str
    router_names: list[str]
    cert_resolvers: list[str]
    expires_at: datetime | None
    days_remaining: int | None
    status: Literal["active", "warning", "error", "pending", "inactive"]
    status_message: str
    status_started_at: datetime | None = None
    alerts_suppressed: bool = False
    last_acme_error_at: datetime | None = None
    last_acme_error_message: str | None = None
    last_acme_error_kind: Literal["dns", "rate_limit", "authorization", "challenge", "unknown"] | None = None


class CertificateCheckResponse(BaseModel):
    checked_at: datetime
    total_count: int
    warning_count: int
    error_count: int
    recorded_event_count: int


class CertificatePreflightItemResponse(BaseModel):
    key: Literal[
        "router_detected",
        "cert_resolver",
        "dns_public",
        "http_challenge",
        "https_certificate",
        "recent_acme_failure",
    ]
    label: str
    status: Literal["ok", "warning", "error"]
    detail: str


class CertificatePreflightResponse(BaseModel):
    domain: str
    checked_at: datetime
    overall_status: Literal["ok", "warning", "error"]
    recommendation: str
    items: list[CertificatePreflightItemResponse]
