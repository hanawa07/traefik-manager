import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI

from app.app_factory import create_app
from app.app_lifespan import (
    alert_retry_loop as _alert_retry_loop,
    auth_cleanup_loop as _auth_cleanup_loop,
    certificate_alert_loop as _certificate_alert_loop,
    certificate_preflight_loop as _certificate_preflight_loop,
    check_certificate_alerts_once as _check_certificate_alerts_once,
    check_certificate_preflight_once as _check_certificate_preflight_once,
    cleanup_auth_state_once as _cleanup_auth_state_once,
    ensure_authentik_middleware_file as _ensure_authentik_middleware_file,
    ensure_service_route_files as _ensure_service_route_files,
    ensure_traefik_dashboard_public_route as _ensure_traefik_dashboard_public_route,
    manager_health_loop as _manager_health_loop,
)
from app.core.logging_config import setup_logging
from app.infrastructure.persistence.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    await init_db()
    await _ensure_service_route_files()
    await _ensure_authentik_middleware_file()
    await _ensure_traefik_dashboard_public_route()
    await _cleanup_auth_state_once()
    await _check_certificate_alerts_once()
    await _check_certificate_preflight_once()
    cleanup_task = asyncio.create_task(_auth_cleanup_loop())
    certificate_task = asyncio.create_task(_certificate_alert_loop())
    certificate_preflight_task = asyncio.create_task(_certificate_preflight_loop())
    alert_retry_task = asyncio.create_task(_alert_retry_loop())
    manager_health_task = asyncio.create_task(_manager_health_loop())
    try:
        yield
    finally:
        cleanup_task.cancel()
        certificate_task.cancel()
        certificate_preflight_task.cancel()
        alert_retry_task.cancel()
        manager_health_task.cancel()
        with suppress(asyncio.CancelledError):
            await cleanup_task
        with suppress(asyncio.CancelledError):
            await certificate_task
        with suppress(asyncio.CancelledError):
            await certificate_preflight_task
        with suppress(asyncio.CancelledError):
            await alert_retry_task
        with suppress(asyncio.CancelledError):
            await manager_health_task


app = create_app(lifespan=lifespan)
