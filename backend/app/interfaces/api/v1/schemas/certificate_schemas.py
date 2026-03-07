from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class CertificateResponse(BaseModel):
    domain: str
    router_names: list[str]
    cert_resolvers: list[str]
    expires_at: datetime | None
    days_remaining: int | None
    status: Literal["active", "warning", "error"]
    status_message: str
