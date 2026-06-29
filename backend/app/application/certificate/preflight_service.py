from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.certificate.preflight_history import (
    calculate_preflight_failure_streak,
    deserialize_preflight_snapshot,
    deserialize_repeated_failure_alert,
    resolve_certificate_diagnostics_settings,
    serialize_preflight_detail,
    serialize_repeated_failure_detail,
    should_emit_repeated_failure_alert,
)
from app.application.audit import audit_service
from app.core.certificate_diagnostics import CertificateDiagnosticsSettings
from app.core.config import settings
from app.infrastructure.persistence.models import AuditLogModel


async def record_certificate_preflight_result(
    *,
    db: AsyncSession,
    actor: str,
    domain: str,
    result: dict,
    client_ip: str | None,
    config: CertificateDiagnosticsSettings | None = None,
) -> dict:
    resolved_config = resolve_certificate_diagnostics_settings(config)
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
    resolved_config = resolve_certificate_diagnostics_settings(config)
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
