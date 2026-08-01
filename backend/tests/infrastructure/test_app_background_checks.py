import pytest

from app import app_background_checks
from app.infrastructure.docker import (
    manager_deployment_bottleneck_storage_monitor,
    manager_health_monitor,
    manager_http_error_monitor,
    manager_http_log_storage_monitor,
    manager_settings_history_latency_monitor,
    manager_watchdog_monitor,
)
from app.infrastructure.traefik import encoded_path_block_history


@pytest.mark.asyncio
async def test_manager_checks_continue_after_individual_failure(monkeypatch) -> None:
    calls: list[str] = []

    def make_check(name: str, *, fail: bool = False):
        async def check() -> None:
            calls.append(name)
            if fail:
                raise RuntimeError("expected failure")

        return check

    checks = (
        (manager_health_monitor, "check_manager_health_once", "health", True),
        (manager_watchdog_monitor, "check_watchdog_staleness_once", "watchdog", False),
        (manager_http_error_monitor, "check_manager_http_errors_once", "http", False),
        (
            manager_http_log_storage_monitor,
            "check_manager_http_log_storage_once",
            "storage",
            False,
        ),
        (
            manager_settings_history_latency_monitor,
            "check_manager_settings_history_latency_once",
            "latency",
            False,
        ),
        (
            manager_deployment_bottleneck_storage_monitor,
            "check_manager_deployment_bottleneck_storage_once",
            "bottleneck",
            False,
        ),
        (
            encoded_path_block_history,
            "collect_encoded_path_block_history",
            "encoded-paths",
            False,
        ),
    )
    for module, attribute, name, fail in checks:
        monkeypatch.setattr(module, attribute, make_check(name, fail=fail))

    await app_background_checks.check_manager_health_once()

    assert calls == [
        "health",
        "watchdog",
        "http",
        "storage",
        "latency",
        "bottleneck",
        "encoded-paths",
    ]
