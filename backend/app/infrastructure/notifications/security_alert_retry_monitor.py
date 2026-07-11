import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.notifications import security_alert_notifier
from app.infrastructure.notifications.security_alert_delivery_log import get_event
from app.infrastructure.notifications.security_alert_retry import build_retry_delivery_context
from app.infrastructure.persistence.models import AuditLogModel

ALERT_RETRY_INTERVAL_SECONDS = 300
ALERT_RETRY_WINDOW_HOURS = 24
MAX_AUTO_RETRY_ATTEMPTS = 3
MAX_RETRIES_PER_RUN = 5
FAILURE_EVENTS = {"security_alert_delivery_failure", "change_alert_delivery_failure"}


def select_auto_retry_candidates(logs: list[AuditLogModel]) -> list[AuditLogModel]:
    retried_ids = {
        str(retry_of)
        for log in logs
        if (retry_of := (log.detail or {}).get("retry_of_audit_id"))
    }
    candidates = []
    for log in logs:
        detail = log.detail or {}
        if get_event(log) not in FAILURE_EVENTS or str(log.id) in retried_ids:
            continue
        try:
            attempts = int(detail.get("auto_retry_attempt") or 0)
            build_retry_delivery_context(log)
        except (TypeError, ValueError):
            continue
        if attempts < MAX_AUTO_RETRY_ATTEMPTS:
            candidates.append(log)
    return candidates[:MAX_RETRIES_PER_RUN]


async def retry_failed_deliveries_once(
    db: AsyncSession,
    *,
    now: datetime | None = None,
) -> int:
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    cutoff = current.astimezone(timezone.utc).replace(tzinfo=None) - timedelta(
        hours=ALERT_RETRY_WINDOW_HOURS
    )
    result = await db.execute(
        select(AuditLogModel)
        .where(AuditLogModel.action == "alert", AuditLogModel.created_at >= cutoff)
        .order_by(desc(AuditLogModel.created_at))
        .limit(200)
    )
    candidates = select_auto_retry_candidates(list(result.scalars().all()))
    for delivery_log in candidates:
        await security_alert_notifier.retry_delivery(
            db,
            delivery_log,
            trigger="automatic_retry",
        )
    return len(candidates)


async def run_periodic_alert_retry(
    interval_seconds: int,
    retry_once,
    sleep=asyncio.sleep,
) -> None:
    while True:
        try:
            await sleep(interval_seconds)
        except asyncio.CancelledError:
            return
        await retry_once()
