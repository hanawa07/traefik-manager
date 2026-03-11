from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class SessionUserResponse(BaseModel):
    username: str
    role: Literal["admin", "viewer"]


class LoginResponse(SessionUserResponse):
    pass


class LoginProtectionResponse(BaseModel):
    turnstile_enabled: bool
    turnstile_site_key: str | None = None


class CurrentSessionResponse(SessionUserResponse):
    session_id: str
    issued_at: datetime
    expires_at: datetime
    idle_expires_at: datetime


class SessionInfoResponse(BaseModel):
    session_id: str
    issued_at: datetime
    last_seen_at: datetime | None
    expires_at: datetime
    idle_expires_at: datetime
    ip_address: str | None
    user_agent: str | None
    is_current: bool


class SessionListResponse(BaseModel):
    sessions: list[SessionInfoResponse]
