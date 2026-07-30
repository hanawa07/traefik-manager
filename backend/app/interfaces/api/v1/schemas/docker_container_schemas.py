from pydantic import BaseModel


class DockerContainerPortResponse(BaseModel):
    private_port: int
    public_port: int | None = None
    type: str | None = None


class DockerTraefikCandidateResponse(BaseModel):
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
    ports: list[DockerContainerPortResponse]
    networks: list[str]
    traefik_candidates: list[DockerTraefikCandidateResponse]


class DockerContainerListResponse(BaseModel):
    enabled: bool
    socket_path: str
    message: str
    containers: list[DockerContainerResponse]
