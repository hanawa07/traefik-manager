import csv
import io
from datetime import datetime
from uuid import uuid4

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.infrastructure.persistence.models import AuditLogModel, SystemSettingModel
from app.interfaces.api.v1.routers import audit as audit_router
from app.interfaces.api.v1.routers import audit_export as audit_export_router
from app.interfaces.api.v1.routers.audit_export import _safe_cell
from tests.interfaces.api.audit_router_fakes import make_log


@pytest.mark.asyncio
async def test_export_audit_logs_uses_date_and_search_filters(monkeypatch):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(AuditLogModel.__table__.create)
        await connection.run_sync(SystemSettingModel.__table__.create)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as db:
        delayed_root = make_log(
            action="alert",
            resource_type="settings",
            resource_name="재시도 원본",
            created_at=datetime(2026, 7, 2, 10),
        )
        db.add_all(
            [
                delayed_root,
                make_log(
                    action="alert",
                    resource_type="settings",
                    resource_name="지연 자동 재시도",
                    event="security_alert_delivery_failure",
                    created_at=datetime(2026, 7, 2, 10, 11),
                    detail_extra={
                        "retry_of_audit_id": str(delayed_root.id),
                        "trigger": "automatic_retry",
                    },
                ),
                make_log(
                    actor="=cmd",
                    resource_name="English Service",
                    event="service_updated",
                    created_at=datetime(2026, 7, 2, 12),
                    detail_extra={"memo": "한글"},
                ),
                make_log(resource_name="Old", created_at=datetime(2026, 7, 1, 12)),
                make_log(
                    resource_name="traefik-smoke-viewer",
                    event="smoke_rotation_failed",
                    created_at=datetime(2026, 7, 2, 13),
                    detail_extra={
                        "step": "GitHub secret 갱신 실패: TM_SMOKE_PASSWORD (시도 3/3)"
                    },
                ),
            ]
        )
        await db.commit()

    monkeypatch.setattr(audit_export_router, "AsyncSessionLocal", session_factory)
    app = FastAPI()
    app.include_router(audit_router.router, prefix="/audit")
    app.dependency_overrides[audit_router.get_current_user] = lambda: {"username": "admin"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/audit/export.csv",
            params={
                "start_date": "2026-07-02",
                "end_date": "2026-07-02",
                "search": "English",
            },
        )
        invalid = await client.get(
            "/audit/export.csv",
            params={"period_days": "7", "start_date": "2026-07-02"},
        )
        rotation_response = await client.get(
            "/audit/export.csv",
            params={"event": "smoke_rotation_result"},
        )
        delayed_response = await client.get(
            "/audit/export.csv",
            params={"retry_delay": "delayed"},
        )

    await engine.dispose()
    rows = list(csv.DictReader(io.StringIO(response.content.decode("utf-8-sig"))))
    assert response.status_code == 200
    assert response.headers["content-disposition"].startswith("attachment;")
    assert len(rows) == 1
    assert rows[0]["actor"] == "'=cmd"
    assert rows[0]["resource_name"] == "English Service"
    assert '"memo":"한글"' in rows[0]["detail"]
    assert invalid.status_code == 422
    rotation_rows = list(
        csv.DictReader(io.StringIO(rotation_response.content.decode("utf-8-sig")))
    )
    assert len(rotation_rows) == 1
    assert rotation_rows[0]["rotation_result"] == "실패"
    assert rotation_rows[0]["failed_secret"] == "TM_SMOKE_PASSWORD"
    assert rotation_rows[0]["attempt_count"] == "3/3"
    assert rotation_rows[0]["failure_step"].startswith("GitHub secret 갱신 실패")
    delayed_rows = list(csv.DictReader(io.StringIO(delayed_response.content.decode("utf-8-sig"))))
    assert [row["resource_name"] for row in delayed_rows] == ["지연 자동 재시도"]


@pytest.mark.asyncio
async def test_export_audit_logs_filters_bulk_operation(monkeypatch):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(AuditLogModel.__table__.create)
        await connection.run_sync(SystemSettingModel.__table__.create)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    operation_id = uuid4()

    async with session_factory() as db:
        db.add_all(
            [
                make_log(
                    resource_type="service",
                    resource_name="English",
                    event="service_update",
                    created_at=datetime(2026, 7, 19, 12),
                    detail_extra={
                        "bulk_operation_id": str(operation_id),
                        "before": {"routing_mode": "active"},
                        "after": {"routing_mode": "maintenance"},
                    },
                ),
                make_log(
                    resource_type="service",
                    resource_name="Other",
                    event="service_update",
                    created_at=datetime(2026, 7, 19, 12),
                    detail_extra={"bulk_operation_id": str(uuid4())},
                ),
            ]
        )
        await db.commit()

    monkeypatch.setattr(audit_export_router, "AsyncSessionLocal", session_factory)
    app = FastAPI()
    app.include_router(audit_router.router, prefix="/audit")
    app.dependency_overrides[audit_router.get_current_user] = lambda: {
        "username": "admin"
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/audit/export.csv",
            params={"bulk_operation_id": str(operation_id)},
        )

    await engine.dispose()
    rows = list(csv.DictReader(io.StringIO(response.content.decode("utf-8-sig"))))
    assert response.status_code == 200
    assert response.headers["content-disposition"] == (
        f'attachment; filename="audit-bulk-{operation_id}.csv"'
    )
    assert [row["resource_name"] for row in rows] == ["English"]
    assert rows[0]["bulk_operation_id"] == str(operation_id)
    assert rows[0]["routing_mode_before"] == "active"
    assert rows[0]["routing_mode_after"] == "maintenance"


@pytest.mark.parametrize("value", ["=cmd", "+cmd", "-cmd", "@cmd", "\t=cmd", "\r=cmd"])
def test_safe_cell_escapes_spreadsheet_formula_prefixes(value: str):
    assert _safe_cell(value) == f"'{value}"
