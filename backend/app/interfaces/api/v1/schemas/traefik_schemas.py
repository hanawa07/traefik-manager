from pydantic import BaseModel, Field


class TraefikHealthResponse(BaseModel):
    connected: bool
    message: str
    version: str | None = None


class TraefikRouterItemResponse(BaseModel):
    name: str
    status: str
    rule: str


class TraefikDomainRouterStatusResponse(BaseModel):
    active: bool
    routers: list[TraefikRouterItemResponse] = Field(default_factory=list)


class TraefikRouterStatusResponse(BaseModel):
    connected: bool
    message: str
    domains: dict[str, TraefikDomainRouterStatusResponse] = Field(default_factory=dict)
