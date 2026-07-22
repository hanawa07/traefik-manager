from datetime import datetime, timedelta, timezone

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.models import (
    AUDIT_EVENT_EXPRESSION,
    AUDIT_SOURCE_EVENT_EXPRESSION,
    AuditLogModel,
)
from app.interfaces.api.v1.routers.audit_log_filters import GITHUB_API_RATE_LIMIT_EVENTS
from app.interfaces.api.v1.routers.settings_audit_helpers import build_settings_test_history_response
from app.interfaces.api.v1.routers.settings_events import SETTINGS_DELIVERY_EVENTS, SETTINGS_TEST_EVENTS
from app.interfaces.api.v1.routers.settings_time_helpers import normalize_utc
from app.interfaces.api.v1.schemas.settings_schemas import SettingsTestHistoryResponse


async def get_settings_test_history_response(db: AsyncSession) -> SettingsTestHistoryResponse:
    logs: list[AuditLogModel] = []
    failure_counts: dict[str, int] = {}

    for key, event_name in SETTINGS_TEST_EVENTS.items():
        rows, failure_count = await _load_history_rows(db, {event_name})
        logs.extend(rows)
        failure_counts[key] = failure_count

    for key, event_names in SETTINGS_DELIVERY_EVENTS.items():
        rows, failure_count = await _load_history_rows(
            db,
            event_names,
            success_event=next(event for event in event_names if event.endswith("_success")),
            failure_event=next(event for event in event_names if event.endswith("_failure")),
        )
        logs.extend(rows)
        failure_counts[key] = failure_count

    for source_event in GITHUB_API_RATE_LIMIT_EVENTS:
        operational_success = await _load_one(
            db,
            select(AuditLogModel)
            .where(
                AuditLogModel.resource_type == "settings",
                AUDIT_EVENT_EXPRESSION == "change_alert_delivery_success",
                AUDIT_SOURCE_EVENT_EXPRESSION == source_event,
            )
            .order_by(desc(AuditLogModel.created_at))
            .limit(1),
        )
        latest_trigger = await _load_one(
            db,
            select(AuditLogModel)
            .where(
                AuditLogModel.resource_type == "settings",
                AUDIT_EVENT_EXPRESSION == source_event,
                AuditLogModel.detail["alert_triggered"].as_boolean().is_(True),
            )
            .order_by(desc(AuditLogModel.created_at))
            .limit(1),
        )
        logs.extend(log for log in (operational_success, latest_trigger) if log is not None)
    logs = list({str(log.id): log for log in logs}.values())
    logs.sort(key=lambda log: normalize_utc(log.created_at), reverse=True)

    response = build_settings_test_history_response(logs)
    for key, count in failure_counts.items():
        getattr(response, key).recent_failure_count = count
    return response


async def _load_history_rows(
    db: AsyncSession,
    event_names: set[str],
    *,
    success_event: str | None = None,
    failure_event: str | None = None,
) -> tuple[list[AuditLogModel], int]:
    recent = (
        await db.execute(
            select(AuditLogModel)
            .where(
                AuditLogModel.resource_type == "settings",
                _event_condition(event_names),
            )
            .order_by(desc(AuditLogModel.created_at))
            .limit(5)
        )
    ).scalars().all()
    latest_success = await _load_one(
        db,
        select(AuditLogModel)
        .where(
            AuditLogModel.resource_type == "settings",
            _event_condition({success_event} if success_event else event_names),
            *([] if success_event else [AuditLogModel.detail["success"].as_boolean().is_(True)]),
        )
        .order_by(desc(AuditLogModel.created_at))
        .limit(1),
    )
    failure_conditions = [
        AuditLogModel.resource_type == "settings",
        _event_condition({failure_event} if failure_event else event_names),
        *([] if failure_event else [AuditLogModel.detail["success"].as_boolean().is_(False)]),
    ]
    latest_failure = await _load_one(
        db,
        select(AuditLogModel)
        .where(*failure_conditions)
        .order_by(desc(AuditLogModel.created_at))
        .limit(1),
    )
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=24)
    failure_count = (
        await db.execute(
            select(func.count(AuditLogModel.id)).where(
                *failure_conditions,
                AuditLogModel.created_at >= cutoff,
            )
        )
    ).scalar_one()
    rows = [*recent, latest_success, latest_failure]
    return [row for row in rows if row is not None], int(failure_count)


def _event_condition(event_names: set[str]):
    if len(event_names) == 1:
        return AUDIT_EVENT_EXPRESSION == next(iter(event_names))
    return AUDIT_EVENT_EXPRESSION.in_(event_names)


async def _load_one(db: AsyncSession, query) -> AuditLogModel | None:
    return (await db.execute(query)).scalar_one_or_none()
