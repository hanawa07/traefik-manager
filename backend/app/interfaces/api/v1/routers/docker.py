from fastapi import APIRouter

from app.application.manager_health_monitoring import read_external_watchdog_stale_minutes
from app.application.manager_http_error_monitoring import read_manager_http_error_monitor_status
from app.core.manager_watchdog_state import read_manager_watchdog_state
from app.core.traefik_self_ban_watchdog_state import (
    read_traefik_self_ban_watchdog_state,
)
from app.core.user_systemd_watchdog_state import read_user_systemd_watchdog_state
from app.infrastructure.docker.client import DockerClient
from app.infrastructure.docker.manager_http_log_reader import read_manager_http_error_preview
from app.infrastructure.docker.manager_settings_history_latency_monitor import (
    read_manager_settings_history_latency_status,
)
from app.infrastructure.github_actions_run import GitHubActionsRunStatusReader
from app.infrastructure.manager_deployment_history import (
    read_manager_deployment_history,
    read_manager_deployment_history_archive_with_summary,
)
from app.infrastructure.manager_deployment_bottleneck import (
    read_manager_deployment_bottleneck_state,
)
from app.infrastructure.traefik.traefik_api_client import TraefikApiClient
from app.interfaces.api.dependencies import get_current_user
from app.interfaces.api.v1.routers.docker_container_routes import (
    register_docker_container_routes,
)
from app.interfaces.api.v1.routers.docker_deployment_routes import (
    register_docker_deployment_routes,
)
from app.interfaces.api.v1.routers.docker_http_error_routes import (
    register_docker_http_error_routes,
)

router = APIRouter()


def get_docker_client() -> DockerClient:
    return DockerClient()


def get_traefik_client() -> TraefikApiClient:
    return TraefikApiClient()


_container_endpoints = register_docker_container_routes(
    router,
    get_docker_client=get_docker_client,
    current_user_dependency=get_current_user,
)
list_containers = _container_endpoints.list_containers

_http_error_endpoints = register_docker_http_error_routes(
    router,
    get_docker_client=get_docker_client,
    current_user_dependency=get_current_user,
    preview_reader_provider=lambda: read_manager_http_error_preview,
)
get_manager_http_errors = _http_error_endpoints.get_manager_http_errors
preview_manager_http_errors = _http_error_endpoints.preview_manager_http_errors

_deployment_endpoints = register_docker_deployment_routes(
    router,
    get_docker_client=get_docker_client,
    get_traefik_client=get_traefik_client,
    current_user_dependency=get_current_user,
    stale_minutes_reader_provider=lambda: read_external_watchdog_stale_minutes,
    http_error_monitor_reader_provider=lambda: read_manager_http_error_monitor_status,
    settings_latency_reader_provider=lambda: read_manager_settings_history_latency_status,
    watchdog_state_reader_provider=lambda: read_manager_watchdog_state,
    self_ban_state_reader_provider=lambda: read_traefik_self_ban_watchdog_state,
    user_systemd_state_reader_provider=lambda: read_user_systemd_watchdog_state,
    run_status_reader_provider=lambda: GitHubActionsRunStatusReader(),
    deployment_history_reader_provider=lambda: read_manager_deployment_history,
    deployment_archive_reader_provider=(
        lambda: read_manager_deployment_history_archive_with_summary
    ),
    bottleneck_state_reader_provider=lambda: read_manager_deployment_bottleneck_state,
)
get_deployment_info = _deployment_endpoints.get_deployment_info

__all__ = [
    "get_deployment_info",
    "get_docker_client",
    "get_manager_http_errors",
    "get_traefik_client",
    "list_containers",
    "preview_manager_http_errors",
    "router",
]
