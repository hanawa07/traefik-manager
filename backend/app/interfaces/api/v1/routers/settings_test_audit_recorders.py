from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.interfaces.api.v1.routers.settings_cloudflare_drift import CloudflareDriftSummary
from app.interfaces.api.v1.routers.settings_cloudflare_reconcile import CloudflareReconcileSummary
from app.interfaces.api.v1.routers.settings_events import SETTINGS_TEST_EVENTS
from app.interfaces.api.v1.schemas.settings_schemas import SettingsTestActionResponse


async def record_cloudflare_connection_test_audit(
    *,
    audit_service: Any,
    db: AsyncSession,
    actor: str,
    result: SettingsTestActionResponse,
    client_ip: str,
) -> None:
    await audit_service.record(
        db=db,
        actor=actor,
        action="test",
        resource_type="settings",
        resource_id=SETTINGS_TEST_EVENTS["cloudflare"],
        resource_name="Cloudflare 연결 테스트",
        detail={
            "event": SETTINGS_TEST_EVENTS["cloudflare"],
            "success": result.success,
            "message": result.message,
            "detail": result.detail,
            "client_ip": client_ip,
        },
    )


async def record_cloudflare_drift_audit(
    *,
    audit_service: Any,
    db: AsyncSession,
    actor: str,
    summary: CloudflareDriftSummary,
    client_ip: str,
) -> None:
    result = summary.result
    await audit_service.record(
        db=db,
        actor=actor,
        action="test",
        resource_type="settings",
        resource_id=SETTINGS_TEST_EVENTS["cloudflare_drift"],
        resource_name="Cloudflare DNS 드리프트 진단",
        detail={
            "event": SETTINGS_TEST_EVENTS["cloudflare_drift"],
            "success": result.success,
            "message": result.message,
            "detail": result.detail,
            "zone_count": summary.zone_count,
            "total_services": summary.total_service_count,
            "eligible_services": summary.eligible_service_count,
            "skipped_services": summary.skipped_count,
            "healthy_services": summary.healthy_count,
            "missing_records": len(summary.missing_records),
            "mismatched_records": len(summary.mismatched_records),
            "orphan_records": len(summary.orphan_records),
            "excluded_services": len(summary.excluded_services),
            "sample_missing_domains": [item.domain for item in summary.missing_records[:5]],
            "sample_mismatched_domains": [item.domain for item in summary.mismatched_records[:5]],
            "sample_orphan_domains": [item.domain for item in summary.orphan_records[:5]],
            "sample_excluded_domains": [item.domain for item in summary.excluded_services[:5]],
            "client_ip": client_ip,
        },
    )


async def record_cloudflare_reconcile_audit(
    *,
    audit_service: Any,
    db: AsyncSession,
    actor: str,
    summary: CloudflareReconcileSummary,
    client_ip: str,
) -> None:
    result = summary.result
    await audit_service.record(
        db=db,
        actor=actor,
        action="test",
        resource_type="settings",
        resource_id=SETTINGS_TEST_EVENTS["cloudflare_reconcile"],
        resource_name="Cloudflare DNS 재동기화",
        detail={
            "event": SETTINGS_TEST_EVENTS["cloudflare_reconcile"],
            "success": result.success,
            "message": result.message,
            "detail": result.detail,
            "total_services": summary.total_service_count,
            "eligible_services": summary.eligible_service_count,
            "skipped_services": summary.skipped_count,
            "synced_services": summary.synced_count,
            "failed_services": summary.failed_count,
            "cleaned_records": summary.cleaned_count,
            "cleanup_failed_records": summary.cleanup_failed_count,
            "zone_count": summary.zone_count,
            "client_ip": client_ip,
        },
    )


async def record_security_alert_test_audit(
    *,
    audit_service: Any,
    db: AsyncSession,
    actor: str,
    result: SettingsTestActionResponse,
    client_ip: str,
) -> None:
    await audit_service.record(
        db=db,
        actor=actor,
        action="test",
        resource_type="settings",
        resource_id=SETTINGS_TEST_EVENTS["security_alert"],
        resource_name="보안 알림 테스트",
        detail={
            "event": SETTINGS_TEST_EVENTS["security_alert"],
            "success": result.success,
            "message": result.message,
            "detail": result.detail,
            "provider": result.provider,
            "client_ip": client_ip,
        },
    )
