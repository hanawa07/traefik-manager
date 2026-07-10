from typing import Literal

from pydantic import BaseModel


class SmokeRotationStatusResponse(BaseModel):
    status: Literal["never", "running", "success", "failure"]
    last_attempt_at: str | None = None
    last_success_at: str | None = None
    detail: str | None = None
