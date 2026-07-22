from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.models import AuditLogModel
from app.interfaces.api.v1.schemas.audit_schemas import (
    AuditGithubApiRateLimitCustomPeriodResponse,
    AuditGithubApiRateLimitPeriodResponse,
    AuditGithubApiRateLimitSummaryResponse,
)

RATE_LIMIT_EVENTS = {
    "primary": "github_api_primary_rate_limit",
    "secondary": "github_api_secondary_rate_limit",
}
RATE_LIMIT_PERIOD_DAYS = (1, 7, 30, 90)


async def load_github_api_rate_limit_summary(
    db: AsyncSession,
    *,
    start_date: date | None = None,
    end_date: date | None = None,
    now: datetime | None = None,
) -> AuditGithubApiRateLimitSummaryResponse:
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is not None:
        current = current.astimezone(timezone.utc).replace(tzinfo=None)
    cutoffs = {
        days: current - timedelta(days=days)
        for days in RATE_LIMIT_PERIOD_DAYS
    }
    has_custom_period = start_date is not None or end_date is not None
    custom_conditions = []
    if start_date:
        custom_conditions.append(AuditLogModel.created_at >= datetime.combine(start_date, time.min))
    if end_date:
        custom_conditions.append(AuditLogModel.created_at <= datetime.combine(end_date, time.max))

    columns = [
        func.coalesce(
            func.sum(case((AuditLogModel.created_at >= cutoff, 1), else_=0)),
            0,
        ).label(f"days_{days}")
        for days, cutoff in cutoffs.items()
    ]
    if has_custom_period:
        columns.append(
            func.coalesce(
                func.sum(case((and_(*custom_conditions), 1), else_=0)),
                0,
            ).label("custom_count")
        )

    event_column = AuditLogModel.detail["event"].as_string()
    coverage_condition = AuditLogModel.created_at >= cutoffs[90]
    if has_custom_period:
        coverage_condition = or_(coverage_condition, and_(*custom_conditions))
    result = await db.execute(
        select(event_column.label("event"), *columns)
        .where(
            event_column.in_(RATE_LIMIT_EVENTS.values()),
            coverage_condition,
        )
        .group_by(event_column)
    )
    rows = {row["event"]: row for row in result.mappings().all()}

    periods = [
        AuditGithubApiRateLimitPeriodResponse(
            days=days,
            primary=_count(rows, "primary", f"days_{days}"),
            secondary=_count(rows, "secondary", f"days_{days}"),
        )
        for days in RATE_LIMIT_PERIOD_DAYS
    ]
    custom = None
    if has_custom_period:
        custom = AuditGithubApiRateLimitCustomPeriodResponse(
            start_date=start_date,
            end_date=end_date,
            primary=_count(rows, "primary", "custom_count"),
            secondary=_count(rows, "secondary", "custom_count"),
        )
    return AuditGithubApiRateLimitSummaryResponse(periods=periods, custom=custom)


def _count(rows: dict, kind: str, column: str) -> int:
    row = rows.get(RATE_LIMIT_EVENTS[kind])
    return int(row[column]) if row is not None else 0
