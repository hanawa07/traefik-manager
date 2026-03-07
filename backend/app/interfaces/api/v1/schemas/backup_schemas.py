from typing import Literal

from pydantic import BaseModel, Field


class BackupServiceItem(BaseModel):
    name: str
    domain: str
    upstream_host: str
    upstream_port: int
    tls_enabled: bool = True
    https_redirect_enabled: bool = True
    auth_enabled: bool = False
    allowed_ips: list[str] = Field(default_factory=list)
    rate_limit_average: int | None = None
    rate_limit_burst: int | None = None
    custom_headers: dict[str, str] = Field(default_factory=dict)
    basic_auth_users: list[str] = Field(default_factory=list)
    middleware_template_ids: list[str] = Field(default_factory=list)
    authentik_provider_id: str | None = None
    authentik_app_slug: str | None = None
    authentik_group_id: str | None = None
    authentik_group_name: str | None = None
    authentik_policy_id: str | None = None
    authentik_policy_binding_id: str | None = None
    cloudflare_record_id: str | None = None


class BackupRedirectHostItem(BaseModel):
    domain: str
    target_url: str
    permanent: bool = True
    tls_enabled: bool = True


class BackupPayload(BaseModel):
    services: list[BackupServiceItem] = Field(default_factory=list)
    redirect_hosts: list[BackupRedirectHostItem] = Field(default_factory=list)


class BackupExportResponse(BackupPayload):
    pass


class BackupImportRequest(BaseModel):
    mode: Literal["merge", "overwrite"] = "merge"
    data: BackupPayload


class BackupImportResultResponse(BaseModel):
    mode: Literal["merge", "overwrite"]
    created_services: int
    updated_services: int
    deleted_services: int
    created_redirects: int
    updated_redirects: int
    deleted_redirects: int
