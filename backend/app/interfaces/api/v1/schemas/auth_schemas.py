from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class SessionUserResponse(BaseModel):
    username: str
    role: Literal["admin", "viewer"]


class LoginResponse(SessionUserResponse):
    pass


class CurrentSessionResponse(SessionUserResponse):
    session_id: str
    issued_at: datetime
    expires_at: datetime
    idle_expires_at: datetime
