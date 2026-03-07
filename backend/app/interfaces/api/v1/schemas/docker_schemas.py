from pydantic import BaseModel


class DockerContainerCandidateResponse(BaseModel):
    router_name: str
    domain: str
    upstream_host: str
    upstream_port: int
    tls_enabled: bool


class DockerContainerResponse(BaseModel):
    id: str | None = None
    name: str
    image: str | None = None
    state: str | None = None
    status: str | None = None
    candidates: list[DockerContainerCandidateResponse]


class DockerContainerListResponse(BaseModel):
    enabled: bool
    socket_path: str
    message: str
    containers: list[DockerContainerResponse]
