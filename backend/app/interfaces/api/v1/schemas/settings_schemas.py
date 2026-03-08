from pydantic import BaseModel


class CloudflareSettingsStatusResponse(BaseModel):
    enabled: bool
    configured: bool
    zone_id: str | None = None
    record_target: str | None = None
    proxied: bool
    message: str


class CloudflareSettingsUpdateRequest(BaseModel):
    api_token: str = ""
    zone_id: str = ""
    record_target: str = ""
    proxied: bool = False
