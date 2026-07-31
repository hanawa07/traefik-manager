from app.core.config import settings


OCI_LABEL_PREFIX = "org.opencontainers.image."


def build_manager_component(
    *,
    name: str,
    container_name: str,
    container: dict,
    image: dict,
) -> dict:
    config = container.get("Config") if isinstance(container.get("Config"), dict) else {}
    state = container.get("State") if isinstance(container.get("State"), dict) else {}
    health = state.get("Health") if isinstance(state.get("Health"), dict) else {}
    health_logs = health.get("Log") if isinstance(health.get("Log"), list) else []
    last_health_log = next(
        (item for item in reversed(health_logs) if isinstance(item, dict)),
        {},
    )
    image_ref = get_manager_component_image_ref(container)
    image_config = image.get("Config") if isinstance(image.get("Config"), dict) else {}
    labels = _extract_oci_labels(image_config.get("Labels"))
    if not labels:
        labels = _extract_oci_labels(config.get("Labels"))
    env_map = _parse_env(config.get("Env"))

    return {
        "name": name,
        "container_name": container_name,
        "status": "ok",
        "runtime_status": normalize_value(state.get("Status")),
        "health_status": normalize_value(health.get("Status")),
        "health_failing_streak": health.get("FailingStreak")
        if isinstance(health.get("FailingStreak"), int)
        else 0,
        "health_last_checked_at": normalize_value(
            last_health_log.get("End") or last_health_log.get("Start")
        ),
        "health_last_exit_code": last_health_log.get("ExitCode")
        if isinstance(last_health_log.get("ExitCode"), int)
        else None,
        "container_id": normalize_value(container.get("Id")),
        "image": normalize_value(config.get("Image")),
        "image_id": normalize_value(image.get("Id")) or normalize_value(image_ref),
        "image_created": normalize_value(image.get("Created")),
        "version": normalize_value(
            labels.get("org.opencontainers.image.version") or env_map.get("TRAEFIK_MANAGER_VERSION")
        ),
        "revision": normalize_value(
            labels.get("org.opencontainers.image.revision") or env_map.get("TRAEFIK_MANAGER_GIT_SHA")
        ),
        "build_date": normalize_value(
            labels.get("org.opencontainers.image.created") or env_map.get("TRAEFIK_MANAGER_BUILD_DATE")
        ),
        "source": normalize_value(
            labels.get("org.opencontainers.image.source") or env_map.get("TRAEFIK_MANAGER_IMAGE_SOURCE")
        ),
        "oci_labels": labels,
    }


def build_unavailable_component(*, name: str, container_name: str) -> dict:
    return {
        "name": name,
        "container_name": container_name,
        "status": "unavailable",
        "runtime_status": None,
        "health_status": None,
        "health_failing_streak": 0,
        "health_last_checked_at": None,
        "health_last_exit_code": None,
        "container_id": None,
        "image": None,
        "image_id": None,
        "image_created": None,
        "version": None,
        "revision": None,
        "build_date": None,
        "source": None,
        "oci_labels": {},
    }


def build_fallback_component(name: str) -> dict:
    return {
        "name": name,
        "container_name": settings.TRAEFIK_MANAGER_BACKEND_CONTAINER_NAME,
        "status": "local_env",
        "runtime_status": None,
        "health_status": None,
        "health_failing_streak": 0,
        "health_last_checked_at": None,
        "health_last_exit_code": None,
        "container_id": None,
        "image": None,
        "image_id": None,
        "image_created": None,
        "version": normalize_value(settings.TRAEFIK_MANAGER_VERSION),
        "revision": normalize_value(settings.TRAEFIK_MANAGER_GIT_SHA),
        "build_date": normalize_value(settings.TRAEFIK_MANAGER_BUILD_DATE),
        "source": normalize_value(settings.TRAEFIK_MANAGER_IMAGE_SOURCE),
        "oci_labels": {},
    }


def get_manager_component_image_ref(container: dict) -> str | None:
    config = container.get("Config") if isinstance(container.get("Config"), dict) else {}
    return normalize_value(container.get("Image") or config.get("Image"))


def select_component_value(components: list[dict], key: str) -> str | None:
    for component in components:
        value = normalize_value(component.get(key))
        if value:
            return value
    return None


def normalize_value(value) -> str | None:
    text = str(value).strip() if value is not None else ""
    if not text or text.lower() == "unknown":
        return None
    return text


def _extract_oci_labels(labels) -> dict[str, str]:
    if not isinstance(labels, dict):
        return {}
    return {
        str(key): str(value)
        for key, value in labels.items()
        if isinstance(key, str) and key.startswith(OCI_LABEL_PREFIX) and value is not None
    }


def _parse_env(values) -> dict[str, str]:
    if not isinstance(values, list):
        return {}
    parsed: dict[str, str] = {}
    for item in values:
        if not isinstance(item, str) or "=" not in item:
            continue
        key, value = item.split("=", 1)
        parsed[key] = value
    return parsed
