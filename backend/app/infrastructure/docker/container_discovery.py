from urllib.parse import quote

from app.infrastructure.docker.api_client import DockerApiTransport
from app.infrastructure.docker.container_candidate_parser import build_container_candidate


async def list_container_candidates(transport: DockerApiTransport) -> dict:
    if not transport.read_enabled:
        return {
            "enabled": False,
            "socket_path": transport.location,
            "message": "Docker API 연결 경로가 없어 자동 감지가 비활성화되어 있습니다",
            "containers": [],
        }

    payload = await transport.get_list(
        f"/{transport.api_version}/containers/json",
        params={"all": 0},
    )
    return {
        "enabled": True,
        "socket_path": transport.location,
        "message": "Docker 컨테이너 목록을 조회했습니다",
        "containers": [
            build_container_candidate(item)
            for item in payload
            if isinstance(item, dict)
        ],
    }


async def get_container(transport: DockerApiTransport, container_name: str) -> dict:
    return await transport.get_object(
        f"/{transport.api_version}/containers/{quote(container_name, safe='')}/json"
    )
