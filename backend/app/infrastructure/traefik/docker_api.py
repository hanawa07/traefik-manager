import io
import tarfile
from pathlib import Path

import httpx

from app.core.config import settings
from app.infrastructure.docker.logs import (
    decode_docker_log_stream,
    read_docker_container_logs_text as read_container_logs_text,
)


ACME_JSON_PATH = Path("/acme.json")


def read_local_acme_json_text() -> str | None:
    if not ACME_JSON_PATH.exists():
        return None
    try:
        return ACME_JSON_PATH.read_text()
    except OSError:
        return None


async def read_docker_acme_json_text() -> str | None:
    socket_path = Path(settings.DOCKER_SOCKET_PATH)
    if not socket_path.exists():
        return None

    container_name = settings.TRAEFIK_DOCKER_CONTAINER_NAME.strip()
    acme_storage_path = settings.TRAEFIK_ACME_STORAGE_PATH.strip()
    if not container_name or not acme_storage_path:
        return None

    transport = httpx.AsyncHTTPTransport(uds=settings.DOCKER_SOCKET_PATH)
    path = f"/{settings.DOCKER_API_VERSION.strip('/')}/containers/{container_name}/archive"

    try:
        async with httpx.AsyncClient(
            base_url="http://docker",
            transport=transport,
            timeout=settings.DOCKER_API_TIMEOUT_SECONDS,
        ) as client:
            response = await client.get(path, params={"path": acme_storage_path})
            response.raise_for_status()
    except (httpx.HTTPError, OSError):
        return None

    try:
        with tarfile.open(fileobj=io.BytesIO(response.content)) as archive:
            for member in archive.getmembers():
                if not member.isfile():
                    continue
                extracted = archive.extractfile(member)
                if extracted is None:
                    continue
                return extracted.read().decode()
    except (tarfile.TarError, OSError, UnicodeDecodeError):
        return None

    return None


async def read_docker_container_logs_text() -> str | None:
    return await read_container_logs_text(
        container_name=settings.TRAEFIK_DOCKER_CONTAINER_NAME,
        tail_lines=settings.TRAEFIK_LOG_TAIL_LINES,
    )
