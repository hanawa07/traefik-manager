from datetime import datetime, timedelta, timezone

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.audit import audit_service
from app.core.certificate_diagnostics import (
    CertificateDiagnosticsSettings,
    build_certificate_diagnostics_settings,
)
from app.core.config import settings
from app.infrastructure.persistence.models import AuditLogModel
from app.interfaces.api.v1.schemas.certificate_schemas import CertificatePreflightSnapshotResponse

CERTIFICATE_PREFLIGHT_EVENT = "certificate_preflight"
CERTIFICATE_PREFLIGHT_REPEATED_FAILURE_EVENT = "certificate_preflight_repeated_failure"


async def record_certificate_preflight_result(
    *,
    db: AsyncSession,
    actor: str,
    domain: str,
    result: dict,
    client_ip: str | None,
    config: CertificateDiagnosticsSettings | None = None,
) -> dict:
    resolved_config = _resolve_certificate_diagnostics_settings(config)
    previous_results = await list_previous_preflight_results(db, domain)
    previous_alerts = await list_previous_repeated_failure_alerts(db, domain)
    previous_result = previous_results[0] if previous_results else None
    repeated_failure_streak = calculate_preflight_failure_streak(result, previous_results, config=resolved_config)
    repeated_failure_active = repeated_failure_streak >= resolved_config.repeat_alert_threshold

    await audit_service.record(
        db=db,
        actor=actor,
        action="test",
        resource_type="certificate",
        resource_id=domain[:36],
        resource_name=domain,
        detail=serialize_preflight_detail(result, client_ip),
    )

    repeated_failure_emitted = False
    if repeated_failure_streak == resolved_config.repeat_alert_threshold and should_emit_repeated_failure_alert(
        result,
        previous_alerts,
        config=resolved_config,
    ):
        await audit_service.record(
            db=db,
            actor=actor,
            action="alert",
            resource_type="certificate",
            resource_id=domain[:36],
            resource_name=domain,
            detail=serialize_repeated_failure_detail(
                result,
                client_ip=client_ip,
                consecutive_count=repeated_failure_streak,
                config=resolved_config,
            ),
        )
        repeated_failure_emitted = True

    return {
        "previous_result": previous_result,
        "repeated_failure_streak": repeated_failure_streak,
        "repeated_failure_active": repeated_failure_active,
        "repeated_failure_emitted": repeated_failure_emitted,
    }


async def get_certificate_preflight_state(
    db: AsyncSession,
    *,
    config: CertificateDiagnosticsSettings | None = None,
) -> dict[str, dict]:
    if not callable(getattr(db, "execute", None)):
        return {}
    resolved_config = _resolve_certificate_diagnostics_settings(config)
    result = await db.execute(
        select(AuditLogModel)
        .where(AuditLogModel.resource_type == "certificate")
        .order_by(desc(AuditLogModel.created_at))
    )
    logs = result.scalars().all()
    snapshots_by_domain: dict[str, list[dict]] = {}
    for log in logs:
        domain = getattr(log, "resource_name", None)
        if not isinstance(domain, str) or not domain:
            continue
        snapshot = deserialize_preflight_snapshot(log.detail)
        if snapshot is None:
            continue
        snapshots_by_domain.setdefault(domain, []).append(snapshot)

    state: dict[str, dict] = {}
    for domain, snapshots in snapshots_by_domain.items():
        if not snapshots:
            continue
        failure_streak = calculate_preflight_failure_streak(
            snapshots[0],
            snapshots[1:],
            config=resolved_config,
        )
        state[domain] = {
            "failure_streak": failure_streak,
            "repeated_failure_active": failure_streak >= resolved_config.repeat_alert_threshold,
        }
    return state


async def list_previous_preflight_results(db: AsyncSession, domain: str) -> list[dict]:
    result = await db.execute(
        select(AuditLogModel)
        .where(AuditLogModel.resource_type == "certificate")
        .where(AuditLogModel.resource_name == domain)
        .order_by(desc(AuditLogModel.created_at))
    )
    logs = result.scalars().all()
    snapshots: list[dict] = []
    for log in logs:
        snapshot = deserialize_preflight_snapshot(log.detail)
        if snapshot is not None:
            snapshots.append(snapshot)
    return snapshots


async def list_previous_repeated_failure_alerts(db: AsyncSession, domain: str) -> list[dict]:
    result = await db.execute(
        select(AuditLogModel)
        .where(AuditLogModel.resource_type == "certificate")
        .where(AuditLogModel.resource_name == domain)
        .order_by(desc(AuditLogModel.created_at))
    )
    logs = result.scalars().all()
    alerts: list[dict] = []
    for log in logs:
        alert = deserialize_repeated_failure_alert(log.detail)
        if alert is not None:
            alerts.append(alert)
    return alerts


def serialize_preflight_detail(result: dict, client_ip: str | None) -> dict:
    checked_at = result.get("checked_at")
    checked_at_iso = checked_at.astimezone(timezone.utc).isoformat() if isinstance(checked_at, datetime) else None
    return {
        "event": CERTIFICATE_PREFLIGHT_EVENT,
        "client_ip": client_ip,
        "checked_at": checked_at_iso,
        "overall_status": result.get("overall_status"),
        "recommendation": result.get("recommendation"),
        "items": [
            {
                "key": item.get("key"),
                "label": item.get("label"),
                "status": item.get("status"),
                "detail": item.get("detail"),
            }
            for item in result.get("items", [])
            if isinstance(item, dict)
        ],
    }


def serialize_repeated_failure_detail(
    result: dict,
    *,
    client_ip: str | None,
    consecutive_count: int,
    config: CertificateDiagnosticsSettings | None = None,
) -> dict:
    resolved_config = _resolve_certificate_diagnostics_settings(config)
    checked_at = result.get("checked_at")
    checked_at_iso = checked_at.astimezone(timezone.utc).isoformat() if isinstance(checked_at, datetime) else None
    failure_items = [
        item
        for item in result.get("items", [])
        if isinstance(item, dict) and item.get("status") in {"warning", "error"}
    ]
    return {
        "event": CERTIFICATE_PREFLIGHT_REPEATED_FAILURE_EVENT,
        "client_ip": client_ip,
        "checked_at": checked_at_iso,
        "overall_status": result.get("overall_status"),
        "recommendation": result.get("recommendation"),
        "consecutive_count": consecutive_count,
        "repeat_window_minutes": resolved_config.repeat_alert_window_minutes,
        "cooldown_minutes": resolved_config.repeat_alert_cooldown_minutes,
        "failure_keys": [item.get("key") for item in failure_items if isinstance(item.get("key"), str)],
        "failure_details": [
            {
                "key": item.get("key"),
                "label": item.get("label"),
                "status": item.get("status"),
                "detail": item.get("detail"),
            }
            for item in failure_items
        ],
    }


def deserialize_preflight_snapshot(detail: dict | None) -> dict | None:
    if not isinstance(detail, dict):
        return None
    if detail.get("event") != CERTIFICATE_PREFLIGHT_EVENT:
        return None

    checked_at = detail.get("checked_at")
    overall_status = detail.get("overall_status")
    recommendation = detail.get("recommendation")
    raw_items = detail.get("items")

    if not isinstance(checked_at, str) or overall_status not in {"ok", "warning", "error"}:
        return None
    if not isinstance(recommendation, str) or not isinstance(raw_items, list):
        return None

    try:
        snapshot = CertificatePreflightSnapshotResponse.model_validate(
            {
                "checked_at": checked_at,
                "overall_status": overall_status,
                "recommendation": recommendation,
                "items": raw_items,
            }
        )
    except Exception:
        return None

    return snapshot.model_dump(mode="json")


def deserialize_repeated_failure_alert(detail: dict | None) -> dict | None:
    if not isinstance(detail, dict):
        return None
    if detail.get("event") != CERTIFICATE_PREFLIGHT_REPEATED_FAILURE_EVENT:
        return None
    checked_at = detail.get("checked_at")
    overall_status = detail.get("overall_status")
    failure_keys = detail.get("failure_keys")
    if not isinstance(checked_at, str) or overall_status not in {"warning", "error"}:
        return None
    if not isinstance(failure_keys, list) or not all(isinstance(item, str) for item in failure_keys):
        return None
    return {
        "checked_at": checked_at,
        "overall_status": overall_status,
        "failure_keys": failure_keys,
    }


def calculate_preflight_failure_streak(
    current_result: dict,
    previous_results: list[dict],
    *,
    config: CertificateDiagnosticsSettings | None = None,
) -> int:
    resolved_config = _resolve_certificate_diagnostics_settings(config)
    current_signature = get_preflight_failure_signature(current_result)
    current_status = current_result.get("overall_status")
    current_checked_at = extract_preflight_checked_at(current_result)
    if current_signature is None or current_status not in {"warning", "error"} or current_checked_at is None:
        return 0

    streak = 1
    window = timedelta(minutes=resolved_config.repeat_alert_window_minutes)
    for snapshot in previous_results:
        previous_signature = get_preflight_failure_signature(snapshot)
        previous_status = snapshot.get("overall_status")
        previous_checked_at = extract_preflight_checked_at(snapshot)
        if previous_signature is None or previous_status != current_status or previous_checked_at is None:
            break
        if current_checked_at - previous_checked_at > window:
            break
        if previous_signature != current_signature:
            break
        streak += 1
    return streak


def should_emit_repeated_failure_alert(
    current_result: dict,
    previous_alerts: list[dict],
    *,
    config: CertificateDiagnosticsSettings | None = None,
) -> bool:
    resolved_config = _resolve_certificate_diagnostics_settings(config)
    current_signature = get_preflight_failure_signature(current_result)
    current_checked_at = extract_preflight_checked_at(current_result)
    if current_signature is None or current_checked_at is None:
        return False

    cooldown = timedelta(minutes=resolved_config.repeat_alert_cooldown_minutes)
    for alert in previous_alerts:
        previous_signature = get_repeated_failure_alert_signature(alert)
        previous_checked_at = extract_preflight_checked_at(alert)
        if previous_signature != current_signature or previous_checked_at is None:
            continue
        return current_checked_at - previous_checked_at > cooldown
    return True


def _resolve_certificate_diagnostics_settings(
    config: CertificateDiagnosticsSettings | None,
) -> CertificateDiagnosticsSettings:
    if config is not None:
        return config
    return build_certificate_diagnostics_settings()


def get_preflight_failure_signature(result: dict) -> tuple[str, tuple[str, ...]] | None:
    overall_status = result.get("overall_status")
    if overall_status not in {"warning", "error"}:
        return None
    items = result.get("items")
    if not isinstance(items, list):
        return None
    failing_keys = sorted(
        item.get("key")
        for item in items
        if isinstance(item, dict)
        and item.get("status") in {"warning", "error"}
        and isinstance(item.get("key"), str)
    )
    if not failing_keys:
        return None
    return overall_status, tuple(failing_keys)


def get_repeated_failure_alert_signature(detail: dict) -> tuple[str, tuple[str, ...]] | None:
    overall_status = detail.get("overall_status")
    failure_keys = detail.get("failure_keys")
    if overall_status not in {"warning", "error"} or not isinstance(failure_keys, list):
        return None
    normalized = sorted(item for item in failure_keys if isinstance(item, str))
    if not normalized:
        return None
    return overall_status, tuple(normalized)


def extract_preflight_checked_at(result: dict) -> datetime | None:
    checked_at = result.get("checked_at")
    if isinstance(checked_at, datetime):
        if checked_at.tzinfo is None:
            return checked_at.replace(tzinfo=timezone.utc)
        return checked_at.astimezone(timezone.utc)
    if isinstance(checked_at, str):
        try:
            parsed = datetime.fromisoformat(checked_at)
        except ValueError:
            return None
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    return None
