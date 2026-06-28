from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.models import AuditLogModel
from app.interfaces.api.v1.routers.settings_cloudflare_drift import CloudflareDriftSummary
from app.interfaces.api.v1.routers.settings_cloudflare_reconcile import CloudflareReconcileSummary
from app.interfaces.api.v1.routers.settings_events import SETTINGS_TEST_EVENTS
from app.interfaces.api.v1.schemas.settings_schemas import (
    SettingsTestActionResponse,
    SettingsTestHistoryItemResponse,
)


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


async def record_settings_update(
    *,
    audit_service: Any,
    db: AsyncSession,
    actor: str,
    event: str,
    resource_name: str,
    before: dict[str, object],
    after: dict[str, object],
    client_ip: str | None,
    rollback_payload: dict[str, object] | None = None,
) -> None:
    changed_keys = sorted([key for key in after.keys() if before.get(key) != after.get(key)])
    detail = {
        "event": event,
        "changed_keys": changed_keys,
        "before": before,
        "after": after,
        "summary": after,
        "rollback_supported": rollback_payload is not None,
        "client_ip": client_ip,
    }
    if rollback_payload is not None:
        detail["rollback_payload"] = rollback_payload
    await audit_service.record(
        db=db,
        actor=actor,
        action="update",
        resource_type="settings",
        resource_id=event,
        resource_name=resource_name,
        detail=detail,
    )


async def record_settings_rollback(
    *,
    audit_service: Any,
    db: AsyncSession,
    actor: str,
    rollback_event: str,
    source_audit_id: str,
    resource_name: str,
    before: dict[str, object],
    after: dict[str, object],
    client_ip: str | None,
) -> None:
    changed_keys = sorted([key for key in after.keys() if before.get(key) != after.get(key)])
    await audit_service.record(
        db=db,
        actor=actor,
        action="rollback",
        resource_type="settings",
        resource_id=rollback_event,
        resource_name=resource_name,
        detail={
            "event": rollback_event,
            "source_audit_id": source_audit_id,
            "changed_keys": changed_keys,
            "before": before,
            "after": after,
            "summary": after,
            "client_ip": client_ip,
        },
    )


def find_latest_settings_test_event(
    logs: list[AuditLogModel],
    event_name: str,
) -> SettingsTestHistoryItemResponse:
    return find_latest_settings_events(logs, {event_name})


def find_latest_settings_events(
    logs: list[AuditLogModel],
    event_names: set[str],
) -> SettingsTestHistoryItemResponse:
    latest: SettingsTestHistoryItemResponse | None = None
    last_success_at: datetime | None = None
    last_failure_at: datetime | None = None
    last_failure_audit_id: str | None = None
    last_failure_message: str | None = None
    last_failure_detail: str | None = None
    last_failure_provider: str | None = None
    recent_failure_count = 0
    failure_cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

    for log in logs:
        detail = log.detail or {}
        event_name = detail.get("event")
        if not isinstance(event_name, str) or event_name not in event_names:
            continue
        success = detail.get("success")
        created_at = normalize_utc(log.created_at)
        if latest is None:
            latest = SettingsTestHistoryItemResponse(
                last_event=event_name,
                last_success=success if isinstance(success, bool) else None,
                last_message=detail.get("message") if isinstance(detail.get("message"), str) else None,
                last_detail=detail.get("detail") if isinstance(detail.get("detail"), str) else None,
                last_provider=detail.get("provider") if isinstance(detail.get("provider"), str) else None,
                last_created_at=created_at,
            )

        if isinstance(success, bool) and success and last_success_at is None:
            last_success_at = created_at

        if isinstance(success, bool) and not success:
            if last_failure_at is None:
                last_failure_at = created_at
                last_failure_audit_id = str(log.id)
                last_failure_message = detail.get("message") if isinstance(detail.get("message"), str) else None
                last_failure_detail = detail.get("detail") if isinstance(detail.get("detail"), str) else None
                last_failure_provider = detail.get("provider") if isinstance(detail.get("provider"), str) else None
            if created_at >= failure_cutoff:
                recent_failure_count += 1

    if latest is None:
        return SettingsTestHistoryItemResponse()

    latest.last_success_at = last_success_at
    latest.last_failure_at = last_failure_at
    latest.last_failure_audit_id = last_failure_audit_id
    latest.last_failure_message = last_failure_message
    latest.last_failure_detail = last_failure_detail
    latest.last_failure_provider = last_failure_provider
    latest.recent_failure_count = recent_failure_count
    return latest


def normalize_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
