import io
import tarfile
from pathlib import Path

import httpx

from app.core.config import settings


ACME_JSON_PATH = Path("/acme.json")
DOCKER_LOG_HEADER_LENGTH = 8


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
    socket_path = Path(settings.DOCKER_SOCKET_PATH)
    if not socket_path.exists():
        return None

    container_name = settings.TRAEFIK_DOCKER_CONTAINER_NAME.strip()
    if not container_name:
        return None

    transport = httpx.AsyncHTTPTransport(uds=settings.DOCKER_SOCKET_PATH)
    path = f"/{settings.DOCKER_API_VERSION.strip('/')}/containers/{container_name}/logs"

    try:
        async with httpx.AsyncClient(
            base_url="http://docker",
            transport=transport,
            timeout=settings.DOCKER_API_TIMEOUT_SECONDS,
        ) as client:
            response = await client.get(
                path,
                params={
                    "stdout": 1,
                    "stderr": 1,
                    "tail": settings.TRAEFIK_LOG_TAIL_LINES,
                    "timestamps": 1,
                },
            )
            response.raise_for_status()
    except (httpx.HTTPError, OSError):
        return None

    return decode_docker_log_stream(response.content)


def decode_docker_log_stream(payload: bytes) -> str:
    if not payload:
        return ""

    if len(payload) >= DOCKER_LOG_HEADER_LENGTH and payload[1:4] == b"\x00\x00\x00":
        cursor = 0
        chunks: list[bytes] = []
        while cursor + DOCKER_LOG_HEADER_LENGTH <= len(payload):
            if payload[cursor + 1:cursor + 4] != b"\x00\x00\x00":
                chunks.append(payload[cursor:])
                break
            frame_size = int.from_bytes(payload[cursor + 4:cursor + 8], byteorder="big")
            cursor += DOCKER_LOG_HEADER_LENGTH
            chunks.append(payload[cursor:cursor + frame_size])
            cursor += frame_size
        return b"".join(chunks).decode(errors="ignore")

    return payload.decode(errors="ignore")
