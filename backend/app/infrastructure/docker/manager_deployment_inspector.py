from urllib.parse import quote

from app.core.config import settings
from app.infrastructure.docker.api_client import DockerApiTransport, DockerClientError
from app.infrastructure.docker.deployment_release import ManagerReleaseChecker
from app.infrastructure.docker.manager_component_inspector import (
    build_fallback_component,
    build_manager_component,
    build_unavailable_component,
    get_manager_component_image_ref,
    select_component_value,
)


async def get_manager_deployment_info(
    transport: DockerApiTransport,
    *,
    refresh_latest: bool = False,
) -> dict:
    fallback_component = build_fallback_component("backend")
    if not transport.read_enabled:
        version = fallback_component["version"]
        source = fallback_component["source"]
        release_info = await ManagerReleaseChecker().get_release_status(
            version,
            source,
            force_refresh=refresh_latest,
        )
        return {
            "enabled": False,
            "message": "Docker API 연결 경로가 없어 배포 이미지 라벨을 조회할 수 없습니다",
            "version": version,
            "revision": fallback_component["revision"],
            "build_date": fallback_component["build_date"],
            "source": source,
            **release_info,
            "components": [fallback_component],
        }

    components = await inspect_manager_components(transport)
    ok_count = sum(1 for item in components if item["status"] == "ok")
    version = select_component_value(components, "version") or fallback_component["version"]
    source = select_component_value(components, "source") or fallback_component["source"]
    release_info = await ManagerReleaseChecker().get_release_status(
        version,
        source,
        force_refresh=refresh_latest,
    )
    return {
        "enabled": True,
        "message": f"배포 이미지 라벨을 조회했습니다 ({ok_count}/{len(components)}개)",
        "version": version,
        "revision": select_component_value(components, "revision") or fallback_component["revision"],
        "build_date": select_component_value(components, "build_date") or fallback_component["build_date"],
        "source": source,
        **release_info,
        "components": components,
    }


async def inspect_manager_components(transport: DockerApiTransport) -> list[dict]:
    if not transport.read_enabled:
        return []
    return [
        await _inspect_component(
            transport,
            name="backend",
            container_name=settings.TRAEFIK_MANAGER_BACKEND_CONTAINER_NAME,
        ),
        await _inspect_component(
            transport,
            name="frontend",
            container_name=settings.TRAEFIK_MANAGER_FRONTEND_CONTAINER_NAME,
        ),
    ]


async def _inspect_component(
    transport: DockerApiTransport,
    *,
    name: str,
    container_name: str,
) -> dict:
    try:
        container = await transport.get_object(
            f"/{transport.api_version}/containers/{quote(container_name, safe='')}/json"
        )
    except DockerClientError:
        return build_unavailable_component(name=name, container_name=container_name)

    image_ref = get_manager_component_image_ref(container)
    image = await _inspect_image(transport, image_ref) if image_ref else {}
    return build_manager_component(
        name=name,
        container_name=container_name,
        container=container,
        image=image,
    )


async def _inspect_image(transport: DockerApiTransport, image_ref: str) -> dict:
    try:
        return await transport.get_object(
            f"/{transport.api_version}/images/{quote(image_ref, safe='')}/json"
        )
    except DockerClientError:
        return {}
