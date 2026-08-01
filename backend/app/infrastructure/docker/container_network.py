from urllib.parse import quote

from app.infrastructure.docker.api_client import DockerApiTransport, DockerClientError
from app.infrastructure.docker.container_candidate_parser import extract_networks
from app.infrastructure.docker.container_discovery import get_container


async def connect_container_to_network(
    transport: DockerApiTransport,
    *,
    container_name: str,
    network_name: str,
) -> dict:
    if not transport.read_enabled or not transport.mutation_enabled:
        raise DockerClientError("Docker 조회 또는 변경 API 경로가 없어 네트워크 연결을 실행할 수 없습니다")

    container = await get_container(transport, container_name)
    current_networks = extract_networks(container)
    if network_name in current_networks:
        return {
            "changed": False,
            "container_id": _normalize_text(container.get("Id")),
            "networks": current_networks,
        }

    await transport.post(
        f"/{transport.api_version}/networks/{quote(network_name, safe='')}/connect",
        {"Container": container_name},
    )
    updated_container = await get_container(transport, container_name)
    return {
        "changed": True,
        "container_id": _normalize_text(updated_container.get("Id"))
        or _normalize_text(container.get("Id")),
        "networks": extract_networks(updated_container),
    }


def _normalize_text(value) -> str | None:
    text = str(value).strip() if value is not None else ""
    return text or None
