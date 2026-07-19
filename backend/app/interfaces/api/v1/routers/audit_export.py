import csv
import io
import json
import re
from datetime import date, datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import desc, select

from app.application.security_alert_retry_timing import (
    read_automatic_retry_delay_warning_minutes,
)
from app.infrastructure.persistence.database import AsyncSessionLocal
from app.infrastructure.persistence.models import AuditLogModel
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import (
    SQLiteSystemSettingsRepository,
)
from app.interfaces.api.dependencies import get_current_user
from app.interfaces.api.v1.routers.audit_delayed_retries import load_delayed_automatic_retries
from app.interfaces.api.v1.routers.audit_log_filters import (
    build_audit_log_conditions,
    validate_audit_log_filters,
)

router = APIRouter()
CSV_COLUMNS = (
    "created_at",
    "actor",
    "action",
    "resource_type",
    "resource_id",
    "resource_name",
    "event",
    "rotation_result",
    "failed_secret",
    "attempt_count",
    "failure_step",
    "detail",
)

_FAILED_SECRET_PATTERN = re.compile(r"GitHub secret 갱신 실패:\s+([^\s(]+)")
_ATTEMPT_PATTERN = re.compile(r"\(시도\s+(\d+/\d+)\)")


@router.get("/export.csv", summary="감사 로그 CSV 내보내기")
async def export_audit_logs(
    resource_type: str | None = Query(None),
    action: str | None = Query(None),
    event: str | None = Query(None),
    manager_status: Literal["unhealthy", "recovered"] | None = Query(None),
    manager_source: Literal["docker", "api", "watchdog"] | None = Query(None),
    period_days: int | None = Query(None),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    search: str | None = Query(None, max_length=100),
    security_only: bool = Query(False),
    provider: str | None = Query(None),
    delivery_success: bool | None = Query(None),
    retry_delay: Literal["delayed"] | None = Query(None),
    _: dict = Depends(get_current_user),
):
    validate_audit_log_filters(
        period_days=period_days,
        start_date=start_date,
        end_date=end_date,
    )
    conditions = build_audit_log_conditions(
        resource_type=resource_type,
        action=action,
        event=event,
        manager_status=manager_status,
        manager_source=manager_source,
        period_days=period_days,
        start_date=start_date,
        end_date=end_date,
        search=search,
        security_only=security_only,
        provider=provider,
        delivery_success=delivery_success,
    )
    filename = f"audit-logs-{datetime.now(timezone.utc):%Y%m%d}.csv"
    return StreamingResponse(
        _iter_csv(conditions, delayed_only=retry_delay == "delayed"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


async def _iter_csv(conditions, *, delayed_only: bool = False):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(CSV_COLUMNS)
    yield "\ufeff" + output.getvalue()

    async with AsyncSessionLocal() as db:
        if delayed_only:
            warning_minutes = await read_automatic_retry_delay_warning_minutes(
                SQLiteSystemSettingsRepository(db)
            )
            logs = await load_delayed_automatic_retries(db, conditions, warning_minutes)
            for log in logs:
                yield _write_csv_log(writer, output, log)
            return

        rows = await db.stream_scalars(
            select(AuditLogModel)
            .where(*conditions)
            .order_by(desc(AuditLogModel.created_at), desc(AuditLogModel.id))
        )
        async for log in rows:
            yield _write_csv_log(writer, output, log)


def _write_csv_log(writer, output: io.StringIO, log: AuditLogModel) -> str:
    output.seek(0)
    output.truncate(0)
    detail = log.detail if isinstance(log.detail, dict) else {}
    rotation_values = _smoke_rotation_csv_values(detail)
    writer.writerow(
        (
            log.created_at.isoformat(),
            _safe_cell(log.actor),
            _safe_cell(log.action),
            _safe_cell(log.resource_type),
            _safe_cell(log.resource_id),
            _safe_cell(log.resource_name),
            _safe_cell(detail.get("event")),
            *(_safe_cell(value) for value in rotation_values),
            _safe_cell(json.dumps(detail, ensure_ascii=False, separators=(",", ":"))),
        )
    )
    return output.getvalue()


def _smoke_rotation_csv_values(detail: dict) -> tuple[str, str, str, str]:
    event = detail.get("event")
    if event == "smoke_rotation_succeeded":
        return "성공", "", "", ""
    if event != "smoke_rotation_failed":
        return "", "", "", ""

    step = detail.get("step") if isinstance(detail.get("step"), str) else ""
    secret = _FAILED_SECRET_PATTERN.search(step)
    attempts = _ATTEMPT_PATTERN.search(step)
    return (
        "실패",
        secret.group(1) if secret else "",
        attempts.group(1) if attempts else "",
        step,
    )


def _safe_cell(value: object) -> str:
    text = str(value or "")
    return f"'{text}" if text.startswith(("=", "+", "-", "@", "\t", "\r")) else text
