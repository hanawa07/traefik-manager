from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.infrastructure.persistence.models import AuditLogModel
from app.interfaces.api.v1.routers import settings as settings_router
from tests.interfaces.api.settings_history_router_fakes import (
    make_settings_history_log,
)


async def get_settings_history(logs):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.run_sync(AuditLogModel.__table__.create)
    try:
        async with session_factory() as db:
            db.add_all(
                AuditLogModel(
                    id=log.id,
                    actor=log.actor,
                    action=log.action,
                    resource_type=log.resource_type,
                    resource_id=log.resource_id,
                    resource_name=log.resource_name,
                    detail=log.detail,
                    created_at=log.created_at,
                )
                for log in logs
            )
            await db.commit()
            return await settings_router.get_settings_test_history(
                db=db,
                _={"role": "admin"},
            )
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_get_settings_test_history_includes_delivery_summary():
    now = datetime.now(timezone.utc)
    response = await get_settings_history(
        [
            make_settings_history_log(
                log_id="delivery-failure-latest",
                event="security_alert_delivery_failure",
                actor="system",
                resource_id="security-alert-delivery",
                resource_name="보안 알림 전송 결과",
                detail={
                    "success": False,
                    "message": "전송 실패",
                    "detail": "network down",
                    "provider": "slack",
                },
                created_at=now - timedelta(minutes=5),
            ),
            make_settings_history_log(
                log_id="delivery-success",
                event="security_alert_delivery_success",
                actor="system",
                resource_id="security-alert-delivery",
                resource_name="보안 알림 전송 결과",
                detail={
                    "success": True,
                    "message": "전송 성공",
                    "detail": "slack 채널로 전송했습니다",
                    "provider": "slack",
                },
                created_at=now - timedelta(minutes=10),
            ),
            make_settings_history_log(
                log_id="delivery-failure-previous",
                event="security_alert_delivery_failure",
                actor="system",
                resource_id="security-alert-delivery",
                resource_name="보안 알림 전송 결과",
                detail={
                    "success": False,
                    "message": "이전 실패",
                    "detail": "timeout",
                    "provider": "slack",
                },
                created_at=now - timedelta(hours=2),
            ),
        ]
    )

    assert response.security_alert_delivery.last_event == "security_alert_delivery_failure"
    assert response.security_alert_delivery.last_success is False
    assert response.security_alert_delivery.last_failure_message == "전송 실패"
    assert response.security_alert_delivery.last_failure_detail == "network down"
    assert response.security_alert_delivery.last_failure_provider == "slack"
    assert response.security_alert_delivery.last_success_at == now - timedelta(minutes=10)
    assert response.security_alert_delivery.last_success_provider == "slack"
    assert response.security_alert_delivery.last_failure_at == now - timedelta(minutes=5)
    assert response.security_alert_delivery.recent_failure_count == 2


@pytest.mark.asyncio
async def test_get_settings_test_history_returns_latest_cloudflare_and_security_alert_events():
    now = datetime.now(timezone.utc)
    logs = [
        make_settings_history_log(
            log_id="1",
            event="settings_test_cloudflare",
            resource_id="settings_test_cloudflare",
            resource_name="Cloudflare 연결 테스트",
            detail={"success": True, "message": "성공"},
            created_at=now,
        ),
        make_settings_history_log(
            log_id="2",
            event="settings_test_cloudflare_drift",
            resource_id="settings_test_cloudflare_drift",
            resource_name="Cloudflare DNS 드리프트 진단",
            detail={"success": False, "message": "드리프트 감지"},
            created_at=now,
        ),
        make_settings_history_log(
            log_id="3",
            event="settings_test_cloudflare_reconcile",
            resource_id="settings_test_cloudflare_reconcile",
            resource_name="Cloudflare DNS 재동기화",
            detail={"success": True, "message": "재동기화 완료"},
            created_at=now,
        ),
        make_settings_history_log(
            log_id="4",
            event="settings_test_security_alert",
            resource_id="settings_test_security_alert",
            resource_name="보안 알림 테스트",
            detail={"success": False, "message": "실패", "provider": "slack"},
            created_at=now,
        ),
        make_settings_history_log(
            log_id="5",
            event="security_alert_delivery_failure",
            actor="system",
            resource_id="security-alert-delivery",
            resource_name="보안 알림 전송 결과",
            detail={
                "success": False,
                "message": "이상 징후 로그인 감지: 1.2.3.4",
                "detail": "network down",
                "provider": "slack",
                "source_event": "login_suspicious",
            },
            created_at=now,
        ),
        make_settings_history_log(
            log_id="6",
            event="change_alert_delivery_success",
            actor="system",
            resource_id="change-alert-delivery",
            resource_name="운영 변경 알림 전송 결과",
            detail={
                "success": True,
                "message": "서비스 변경: svc",
                "detail": "pagerduty 채널로 전송했습니다",
                "provider": "pagerduty",
                "source_event": "service_update",
            },
            created_at=now,
        ),
        make_settings_history_log(
            log_id="7",
            event="settings_test_github_api_rate_limit",
            resource_id="settings_test_github_api_rate_limit",
            resource_name="GitHub API 반복 제한 알림 dry-run",
            detail={
                "success": True,
                "message": "GitHub API 반복 제한 dry-run을 전송했습니다",
                "provider": "telegram",
            },
            created_at=now,
        ),
        make_settings_history_log(
            log_id="8",
            event="github_api_primary_rate_limit",
            action="alert",
            detail={"alert_triggered": True},
            created_at=now - timedelta(minutes=2),
        ),
        make_settings_history_log(
            log_id="9",
            event="change_alert_delivery_success",
            actor="system",
            resource_id="change-alert-delivery",
            resource_name="운영 변경 알림 전송 결과",
            detail={
                "success": True,
                "provider": "telegram",
                "source_event": "github_api_primary_rate_limit",
            },
            created_at=now - timedelta(minutes=1),
        ),
    ]

    response = await get_settings_history(logs)

    assert response.cloudflare.last_event == "settings_test_cloudflare"
    assert response.cloudflare.last_success is True
    assert response.cloudflare.last_message == "성공"
    assert response.cloudflare_drift.last_event == "settings_test_cloudflare_drift"
    assert response.cloudflare_drift.last_success is False
    assert response.cloudflare_drift.last_message == "드리프트 감지"
    assert response.cloudflare_reconcile.last_event == "settings_test_cloudflare_reconcile"
    assert response.cloudflare_reconcile.last_success is True
    assert response.cloudflare_reconcile.last_message == "재동기화 완료"
    assert response.security_alert.last_event == "settings_test_security_alert"
    assert response.security_alert.last_success is False
    assert response.security_alert.last_provider == "slack"
    assert response.github_api_rate_limit.last_success is True
    assert response.github_api_rate_limit.last_success_at == now
    assert response.github_api_rate_limit.last_success_provider == "telegram"
    assert response.security_alert_delivery.last_event == "security_alert_delivery_failure"
    assert response.security_alert_delivery.last_success is False
    assert response.security_alert_delivery.last_provider == "slack"
    assert response.security_alert_delivery.last_detail == "network down"
    assert response.change_alert_delivery.last_event == "change_alert_delivery_success"
    assert response.change_alert_delivery.last_success is True
    assert response.change_alert_delivery.last_provider == "pagerduty"
    assert response.github_api_rate_limit_delivery.last_success_at == now - timedelta(minutes=1)
    assert response.github_api_rate_limit_delivery.last_success_provider == "telegram"
    assert response.github_api_rate_limit_last_triggered_at == now - timedelta(minutes=2)


@pytest.mark.asyncio
async def test_get_settings_test_history_accepts_naive_created_at():
    now = datetime.now(timezone.utc)
    logs = [
        make_settings_history_log(
            log_id="1",
            event="security_alert_delivery_failure",
            actor="system",
            resource_id="security-alert-delivery",
            resource_name="보안 알림 전송 결과",
            detail={
                "success": False,
                "message": "이상 징후 로그인 감지: 1.2.3.4",
                "detail": "network down",
                "provider": "slack",
                "source_event": "login_suspicious",
            },
            created_at=(now - timedelta(minutes=5)).replace(tzinfo=None),
        ),
        make_settings_history_log(
            log_id="2",
            event="change_alert_delivery_success",
            actor="system",
            resource_id="change-alert-delivery",
            resource_name="운영 변경 알림 전송 결과",
            detail={
                "success": True,
                "message": "서비스 변경: svc",
                "detail": "pagerduty 채널로 전송했습니다",
                "provider": "pagerduty",
                "source_event": "service_update",
            },
            created_at=now,
        ),
    ]

    response = await get_settings_history(logs)

    assert response.cloudflare_drift.last_event is None
    assert response.cloudflare_reconcile.last_event is None
    assert response.security_alert_delivery.last_event == "security_alert_delivery_failure"
    assert response.security_alert_delivery.last_failure_at is not None
    assert response.security_alert_delivery.last_failure_at.tzinfo is not None
    assert response.security_alert_delivery.recent_failure_count == 1
