import asyncio
import logging

from app.core.certificate_diagnostics import build_certificate_diagnostics_settings
from app.core.config import settings
from app.infrastructure.persistence.database import AsyncSessionLocal
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import (
    SQLiteSystemSettingsRepository,
)

logger = logging.getLogger(__name__)


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
    from app.infrastructure.docker.manager_deployment_bottleneck_storage_monitor import (
        check_manager_deployment_bottleneck_storage_once,
    )
    from app.infrastructure.docker.manager_health_monitor import (
        check_manager_health_once as check_once,
    )
    from app.infrastructure.docker.manager_http_error_monitor import (
        check_manager_http_errors_once,
    )
    from app.infrastructure.docker.manager_http_log_storage_monitor import (
        check_manager_http_log_storage_once,
    )
    from app.infrastructure.docker.manager_settings_history_latency_monitor import (
        check_manager_settings_history_latency_once,
    )
    from app.infrastructure.docker.manager_watchdog_monitor import (
        check_watchdog_staleness_once,
    )
    from app.infrastructure.traefik.encoded_path_block_history import (
        collect_encoded_path_block_history,
    )

    checks = (
        (check_once, "Manager Docker health 점검 실패 (다음 주기에 재시도)"),
        (check_watchdog_staleness_once, "Manager 외부 watchdog 지연 점검 실패 (다음 주기에 재시도)"),
        (check_manager_http_errors_once, "Manager API 오류 임계치 점검 실패 (다음 주기에 재시도)"),
        (check_manager_http_log_storage_once, "Manager 요청 로그 보관 상태 점검 실패 (다음 주기에 재시도)"),
        (
            check_manager_settings_history_latency_once,
            "설정 이력 API p95 점검 실패 (다음 주기에 재시도)",
        ),
        (
            check_manager_deployment_bottleneck_storage_once,
            "Manager 배포 병목 이벤트 보관 상태 점검 실패 (다음 주기에 재시도)",
        ),
        (
            collect_encoded_path_block_history,
            "Traefik 인코딩 경로 차단 이력 수집 실패 (다음 주기에 재시도)",
        ),
    )
    for check, failure_message in checks:
        try:
            await check()
        except Exception:
            logger.warning(failure_message, exc_info=True)


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


async def transition_expired_maintenance_once() -> None:
    from app.infrastructure.traefik.maintenance_expiry_monitor import (
        transition_expired_maintenance_services_once,
    )

    try:
        result = await transition_expired_maintenance_services_once()
        if result["transitioned_count"]:
            logger.info(
                "점검 종료 자동 전환 완료 (%d개): %s",
                result["transitioned_count"],
                ", ".join(result["transitioned_names"]),
            )
    except Exception:
        logger.warning("점검 종료 자동 전환 실패 (다음 주기에 재시도)", exc_info=True)


async def maintenance_expiry_loop() -> None:
    from app.infrastructure.traefik.maintenance_expiry_monitor import (
        MAINTENANCE_EXPIRY_CHECK_INTERVAL_SECONDS,
        run_periodic_maintenance_expiry_check,
    )

    await run_periodic_maintenance_expiry_check(
        interval_seconds=MAINTENANCE_EXPIRY_CHECK_INTERVAL_SECONDS,
        check_once=transition_expired_maintenance_once,
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
