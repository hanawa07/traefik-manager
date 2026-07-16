from urllib.parse import quote

import httpx

from app.core.config import settings
from app.infrastructure.docker.api_client import build_docker_api_client, docker_api_available


DOCKER_LOG_HEADER_LENGTH = 8


async def read_docker_container_logs_text(
    *,
    container_name: str,
    tail_lines: int,
    since: int | None = None,
) -> str | None:
    if not docker_api_available(
        api_url=settings.DOCKER_READ_API_URL,
        socket_path=settings.DOCKER_SOCKET_PATH,
    ) or not container_name.strip():
        return None

    path = (
        f"/{settings.DOCKER_API_VERSION.strip('/')}/containers/"
        f"{quote(container_name.strip(), safe='')}/logs"
    )
    params: dict[str, int] = {
        "stdout": 1,
        "stderr": 1,
        "tail": tail_lines,
        "timestamps": 1,
    }
    if since is not None:
        params["since"] = since

    try:
        async with build_docker_api_client(
            api_url=settings.DOCKER_READ_API_URL,
            socket_path=settings.DOCKER_SOCKET_PATH,
            timeout=settings.DOCKER_API_TIMEOUT_SECONDS,
        ) as client:
            response = await client.get(path, params=params)
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
