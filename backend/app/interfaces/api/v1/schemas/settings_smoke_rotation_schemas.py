from typing import Literal

from pydantic import BaseModel, Field


class SmokeRotationStatusResponse(BaseModel):
    status: Literal["never", "running", "success", "failure"]
    last_attempt_at: str | None = None
    last_success_at: str | None = None
    detail: str | None = None
    is_stale: bool = False
    stale_after_days: int = 35
    recent_log_lines: list[str] = Field(default_factory=list)
    log_updated_at: str | None = None
