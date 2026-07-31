import asyncio

from app.app_background_checks import (
    alert_retry_loop,
    audit_retention_loop,
    auth_cleanup_loop,
    certificate_alert_loop,
    certificate_preflight_loop,
    check_certificate_alerts_once,
    check_certificate_preflight_once,
    cleanup_audit_logs_once,
    cleanup_auth_state_once,
    maintenance_expiry_loop,
    manager_health_loop,
    transition_expired_maintenance_once,
)
from app.app_startup_sync import (
    ensure_authentik_middleware_file,
    ensure_service_route_files,
    ensure_traefik_dashboard_public_route,
)


async def run_active_background_tasks() -> None:
    await ensure_service_route_files()
    await ensure_authentik_middleware_file()
    await ensure_traefik_dashboard_public_route()
    await cleanup_auth_state_once()
    await cleanup_audit_logs_once()
    await check_certificate_alerts_once()
    await check_certificate_preflight_once()
    await transition_expired_maintenance_once()

    tasks = [
        asyncio.create_task(auth_cleanup_loop()),
        asyncio.create_task(audit_retention_loop()),
        asyncio.create_task(certificate_alert_loop()),
        asyncio.create_task(certificate_preflight_loop()),
        asyncio.create_task(alert_retry_loop()),
        asyncio.create_task(manager_health_loop()),
        asyncio.create_task(maintenance_expiry_loop()),
    ]
    try:
        await asyncio.gather(*tasks)
    finally:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
