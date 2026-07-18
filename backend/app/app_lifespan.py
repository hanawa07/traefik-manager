import asyncio
import logging

from app.core.certificate_diagnostics import build_certificate_diagnostics_settings
from app.core.config import settings
from app.infrastructure.persistence.database import AsyncSessionLocal
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import SQLiteSystemSettingsRepository
from app.infrastructure.traefik.file_provider_writer import FileProviderWriter

logger = logging.getLogger(__name__)


async def ensure_service_route_files() -> None:
    from app.infrastructure.persistence.repositories.sqlite_middleware_template_repository import (
        SQLiteMiddlewareTemplateRepository,
    )
    from app.infrastructure.persistence.repositories.sqlite_service_repository import (
        SQLiteServiceRepository,
    )
    from app.infrastructure.traefik.startup_sync import sync_existing_service_configs

    try:
        async with AsyncSessionLocal() as session:
            rewritten = await sync_existing_service_configs(
                service_repository=SQLiteServiceRepository(session),
                middleware_template_repository=SQLiteMiddlewareTemplateRepository(session),
                file_writer=FileProviderWriter(),
            )
            if rewritten > 0:
                logger.info("서비스 라우트 파일 재생성 완료 (서비스 %d개)", rewritten)
    except Exception:
        logger.warning("서비스 라우트 파일 startup 재생성 실패 (무시)", exc_info=True)


async def ensure_authentik_middleware_file() -> None:
    """startup 시 auth_mode가 authentik인 서비스가 있으면 authentik ForwardAuth 미들웨어 파일을 생성한다."""
    from sqlalchemy import text

    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                text("SELECT COUNT(*) FROM services WHERE auth_mode = 'authentik'")
            )
            count = int(result.scalar_one())
            if count > 0:
                FileProviderWriter().write_authentik_middleware()
                logger.info("Authentik 미들웨어 파일 생성 완료 (활성화된 서비스 %d개)", count)
    except Exception:
        logger.warning("Authentik 미들웨어 파일 startup 생성 실패 (무시)", exc_info=True)


async def ensure_traefik_dashboard_public_route() -> None:
    from app.infrastructure.traefik.startup_sync import sync_traefik_dashboard_public_config

    try:
        async with AsyncSessionLocal() as session:
            enabled = await sync_traefik_dashboard_public_config(
                settings_repository=SQLiteSystemSettingsRepository(session),
                file_writer=FileProviderWriter(),
            )
            if enabled:
                logger.info("Traefik 디버그 대시보드 public 라우트 동기화 완료")
    except Exception:
        logger.warning("Traefik 디버그 대시보드 startup 동기화 실패 (무시)", exc_info=True)


async def cleanup_auth_state_once() -> None:
    from app.infrastructure.auth.session_cleanup import cleanup_auth_state_once as cleanup_once
    from app.infrastructure.persistence.repositories.sqlite_auth_session_repository import (
        SQLiteAuthSessionRepository,
    )
    from app.infrastructure.persistence.repositories.sqlite_revoked_token_repository import (
        SQLiteRevokedTokenRepository,
    )

    try:
        async with AsyncSessionLocal() as session:
            deleted_sessions, deleted_tokens = await cleanup_once(
                auth_session_repository=SQLiteAuthSessionRepository(session),
                revoked_token_repository=SQLiteRevokedTokenRepository(session),
            )
            await session.commit()
            if deleted_sessions or deleted_tokens:
                logger.info(
                    "인증 상태 cleanup 완료 (세션 %d개, 폐기 토큰 %d개)",
                    deleted_sessions,
                    deleted_tokens,
                )
    except Exception:
        logger.warning("인증 상태 cleanup 실패 (무시)", exc_info=True)


async def auth_cleanup_loop() -> None:
    from app.infrastructure.auth.session_cleanup import run_periodic_auth_cleanup

    await run_periodic_auth_cleanup(
        interval_seconds=max(60, settings.AUTH_SESSION_CLEANUP_INTERVAL_MINUTES * 60),
        cleanup_once=cleanup_auth_state_once,
    )


async def cleanup_audit_logs_once() -> None:
    from app.infrastructure.persistence.audit_retention import run_audit_retention_once

    try:
        async with AsyncSessionLocal() as session:
            result = await run_audit_retention_once(
                session,
                archive_dir=settings.AUDIT_ARCHIVE_DIR,
            )
            if result["last_deleted_count"]:
                logger.info(
                    "감사 로그 보존 정리 완료 (아카이브 %d개, 삭제 %d개)",
                    result["last_archived_count"],
                    result["last_deleted_count"],
                )
    except Exception:
        logger.warning("감사 로그 보존 정리 실패 (다음 주기에 재시도)", exc_info=True)


async def audit_retention_loop() -> None:
    from app.infrastructure.persistence.audit_retention import (
        AUDIT_RETENTION_INTERVAL_SECONDS,
        run_periodic_audit_retention,
    )

    await run_periodic_audit_retention(
        interval_seconds=AUDIT_RETENTION_INTERVAL_SECONDS,
        cleanup_once=cleanup_audit_logs_once,
    )


async def check_certificate_alerts_once() -> None:
    from app.infrastructure.certificates import check_certificate_alerts_once as check_once

    try:
        await check_once()
    except Exception:
        logger.warning("인증서 알림 체크 실패 (무시)", exc_info=True)


async def certificate_alert_loop() -> None:
    from app.infrastructure.certificates import run_periodic_certificate_alert_check

    await run_periodic_certificate_alert_check(
        interval_seconds=max(300, settings.CERTIFICATE_ALERT_CHECK_INTERVAL_MINUTES * 60),
        check_once=check_certificate_alerts_once,
    )


async def check_manager_health_once() -> None:
    from app.infrastructure.docker.manager_health_monitor import check_manager_health_once as check_once
    from app.infrastructure.docker.manager_watchdog_monitor import (
        check_watchdog_staleness_once,
    )
    from app.infrastructure.docker.manager_http_error_monitor import (
        check_manager_http_errors_once,
    )
    from app.infrastructure.docker.manager_http_log_storage_monitor import (
        check_manager_http_log_storage_once,
    )
    from app.infrastructure.docker.manager_deployment_bottleneck_storage_monitor import (
        check_manager_deployment_bottleneck_storage_once,
    )

    try:
        await check_once()
    except Exception:
        logger.warning("Manager Docker health 점검 실패 (다음 주기에 재시도)", exc_info=True)
    try:
        await check_watchdog_staleness_once()
    except Exception:
        logger.warning("Manager 외부 watchdog 지연 점검 실패 (다음 주기에 재시도)", exc_info=True)
    try:
        await check_manager_http_errors_once()
    except Exception:
        logger.warning("Manager API 오류 임계치 점검 실패 (다음 주기에 재시도)", exc_info=True)
    try:
        await check_manager_http_log_storage_once()
    except Exception:
        logger.warning("Manager 요청 로그 보관 상태 점검 실패 (다음 주기에 재시도)", exc_info=True)
    try:
        await check_manager_deployment_bottleneck_storage_once()
    except Exception:
        logger.warning("Manager 배포 병목 이벤트 보관 상태 점검 실패 (다음 주기에 재시도)", exc_info=True)


async def manager_health_loop() -> None:
    from app.infrastructure.docker.manager_health_monitor import (
        MANAGER_HEALTH_CHECK_INTERVAL_SECONDS,
        run_periodic_manager_health_check,
    )

    await run_periodic_manager_health_check(
        interval_seconds=MANAGER_HEALTH_CHECK_INTERVAL_SECONDS,
        check_once=check_manager_health_once,
    )


async def check_certificate_preflight_once() -> None:
    from app.infrastructure.certificates import run_certificate_preflight_checks_once

    try:
        await run_certificate_preflight_checks_once()
    except Exception:
        logger.warning("인증서 프리플라이트 자동 점검 실패 (무시)", exc_info=True)


async def certificate_preflight_loop() -> None:
    while True:
        await asyncio.sleep(await load_certificate_preflight_interval_seconds())
        await check_certificate_preflight_once()


async def retry_failed_alerts_once() -> None:
    from app.infrastructure.notifications.security_alert_retry_monitor import (
        retry_failed_deliveries_once,
    )

    try:
        async with AsyncSessionLocal() as session:
            retry_count = await retry_failed_deliveries_once(session)
            await session.commit()
            if retry_count:
                logger.info("실패 알림 자동 재시도 완료 (%d개)", retry_count)
    except Exception:
        logger.warning("실패 알림 자동 재시도 실패 (다음 주기에 재시도)", exc_info=True)


async def alert_retry_loop() -> None:
    from app.infrastructure.notifications.security_alert_retry_monitor import (
        ALERT_RETRY_INTERVAL_SECONDS,
        run_periodic_alert_retry,
    )

    await run_periodic_alert_retry(
        interval_seconds=ALERT_RETRY_INTERVAL_SECONDS,
        retry_once=retry_failed_alerts_once,
    )


async def load_certificate_preflight_interval_seconds() -> int:
    try:
        async with AsyncSessionLocal() as session:
            diagnostics_settings = build_certificate_diagnostics_settings(
                await SQLiteSystemSettingsRepository(session).get_all_dict()
            )
            return max(300, diagnostics_settings.auto_check_interval_minutes * 60)
    except Exception:
        logger.warning("인증서 프리플라이트 주기 설정 조회 실패, 기본값 사용", exc_info=True)
        return max(300, settings.CERTIFICATE_PREFLIGHT_AUTO_CHECK_INTERVAL_MINUTES * 60)


async def run_active_background_tasks() -> None:
    await ensure_service_route_files()
    await ensure_authentik_middleware_file()
    await ensure_traefik_dashboard_public_route()
    await cleanup_auth_state_once()
    await cleanup_audit_logs_once()
    await check_certificate_alerts_once()
    await check_certificate_preflight_once()

    tasks = [
        asyncio.create_task(auth_cleanup_loop()),
        asyncio.create_task(audit_retention_loop()),
        asyncio.create_task(certificate_alert_loop()),
        asyncio.create_task(certificate_preflight_loop()),
        asyncio.create_task(alert_retry_loop()),
        asyncio.create_task(manager_health_loop()),
    ]
    try:
        await asyncio.gather(*tasks)
    finally:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
