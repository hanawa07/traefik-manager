from typing import Literal

from pydantic import BaseModel


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: Literal["admin", "viewer"]
