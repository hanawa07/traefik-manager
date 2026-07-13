import csv
import io
from datetime import datetime

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.infrastructure.persistence.models import AuditLogModel
from app.interfaces.api.v1.routers import audit as audit_router
from app.interfaces.api.v1.routers.audit_export import _safe_cell
from tests.interfaces.api.audit_router_fakes import make_log


@pytest.mark.asyncio
async def test_export_audit_logs_uses_date_and_search_filters():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(AuditLogModel.__table__.create)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as db:
        db.add_all(
            [
                make_log(
                    actor="=cmd",
                    resource_name="English Service",
                    event="service_updated",
                    created_at=datetime(2026, 7, 2, 12),
                    detail_extra={"memo": "한글"},
                ),
                make_log(resource_name="Old", created_at=datetime(2026, 7, 1, 12)),
            ]
        )
        await db.commit()

        app = FastAPI()
        app.include_router(audit_router.router, prefix="/audit")
        app.dependency_overrides[audit_router.get_db] = lambda: db
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

    await engine.dispose()
    rows = list(csv.DictReader(io.StringIO(response.content.decode("utf-8-sig"))))
    assert response.status_code == 200
    assert response.headers["content-disposition"].startswith("attachment;")
    assert len(rows) == 1
    assert rows[0]["actor"] == "'=cmd"
    assert rows[0]["resource_name"] == "English Service"
    assert '"memo":"한글"' in rows[0]["detail"]
    assert invalid.status_code == 422


@pytest.mark.parametrize("value", ["=cmd", "+cmd", "-cmd", "@cmd", "\t=cmd", "\r=cmd"])
def test_safe_cell_escapes_spreadsheet_formula_prefixes(value: str):
    assert _safe_cell(value) == f"'{value}"
