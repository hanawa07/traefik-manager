import sqlite3

import pytest
from sqlalchemy.exc import OperationalError

from app import app_background_checks
from app.infrastructure.docker import (
    manager_deployment_bottleneck_storage_monitor,
    manager_health_monitor,
    manager_http_error_monitor,
    manager_http_log_storage_monitor,
    manager_settings_history_latency_monitor,
    manager_watchdog_monitor,
)
from app.infrastructure.traefik import encoded_path_block_monitor


@pytest.mark.parametrize(
    ("error_message", "expected_attempts"),
    (("database is locked", 2), ("disk I/O error", 1)),
)
@pytest.mark.asyncio
async def test_auth_cleanup_only_retries_sqlite_lock(
    monkeypatch,
    error_message: str,
    expected_attempts: int,
) -> None:
    attempts = 0

    async def cleanup_attempt(_cleanup_once) -> tuple[int, int]:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise OperationalError(
                "DELETE FROM auth_sessions",
                {},
                sqlite3.OperationalError(error_message),
            )
        return 0, 0

    monkeypatch.setattr(app_background_checks, "_cleanup_auth_state_attempt", cleanup_attempt)
    monkeypatch.setattr(app_background_checks, "AUTH_CLEANUP_LOCK_RETRY_SECONDS", 0)

    await app_background_checks.cleanup_auth_state_once()

    assert attempts == expected_attempts


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
            encoded_path_block_monitor,
            "check_encoded_path_blocks_once",
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
