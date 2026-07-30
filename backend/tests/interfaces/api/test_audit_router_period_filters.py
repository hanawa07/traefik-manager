from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi import FastAPI, Response
from httpx import ASGITransport, AsyncClient

from app.interfaces.api.v1.routers import audit as audit_router
from tests.interfaces.api.audit_router_fakes import make_log, seed_logs


@pytest.mark.asyncio
async def test_list_audit_logs_parses_period_days_from_http_query(audit_db):
    now = datetime.now(timezone.utc)
    await seed_logs(
        audit_db,
        [
            make_log(resource_name="recent", created_at=now - timedelta(days=1)),
            make_log(resource_name="old", created_at=now - timedelta(days=8)),
        ],
    )
    app = FastAPI()
    app.include_router(audit_router.router, prefix="/audit")
    app.dependency_overrides[audit_router.get_db] = lambda: audit_db
    app.dependency_overrides[audit_router.get_current_user] = lambda: {"username": "admin"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/audit", params={"period_days": "7"})
        invalid_response = await client.get("/audit", params={"period_days": "2"})
        mixed_response = await client.get(
            "/audit", params={"period_days": "7", "start_date": "2026-07-01"}
        )
        reversed_response = await client.get(
            "/audit", params={"start_date": "2026-07-02", "end_date": "2026-07-01"}
        )

    assert response.status_code == 200
    assert [item["resource_name"] for item in response.json()] == ["recent"]
    assert invalid_response.status_code == 422
    assert mixed_response.status_code == 422
    assert reversed_response.status_code == 422


@pytest.mark.asyncio
async def test_list_audit_logs_filters_period_with_naive_and_aware_datetimes(audit_db):
    now = datetime.now(timezone.utc)
    await seed_logs(
        audit_db,
        [
            make_log(resource_name="aware", created_at=now - timedelta(hours=1)),
            make_log(
                resource_name="naive",
                created_at=(now - timedelta(hours=2)).replace(tzinfo=None),
            ),
            make_log(resource_name="old", created_at=now - timedelta(days=2)),
        ],
    )

    response = Response()
    result = await audit_router.list_audit_logs(
        response=response,
        limit=10,
        offset=0,
        resource_type=None,
        action=None,
        event=None,
        manager_status=None,
        manager_source=None,
        period_days=1,
        start_date=None,
        end_date=None,
        search=None,
        security_only=False,
        provider=None,
        delivery_success=None,
        db=audit_db,
        _={"username": "admin"},
    )

    assert {item.resource_name for item in result} == {"aware", "naive"}
    assert response.headers["x-total-count"] == "2"


@pytest.mark.asyncio
async def test_list_audit_logs_filters_utc_date_range(audit_db):
    await seed_logs(
        audit_db,
        [
            make_log(resource_name="before", created_at=datetime(2026, 7, 1, 23, 59, 59)),
            make_log(resource_name="inside", created_at=datetime(2026, 7, 2, 12, 0, 0)),
            make_log(resource_name="after", created_at=datetime(2026, 7, 3, 0, 0, 0)),
        ],
    )

    response = Response()
    result = await audit_router.list_audit_logs(
        response=response,
        limit=10,
        offset=0,
        resource_type=None,
        action=None,
        event=None,
        manager_status=None,
        manager_source=None,
        period_days=None,
        start_date=date(2026, 7, 2),
        end_date=date(2026, 7, 2),
        search=None,
        security_only=False,
        provider=None,
        delivery_success=None,
        db=audit_db,
        _={"username": "admin"},
    )

    assert [item.resource_name for item in result] == ["inside"]
    assert response.headers["x-total-count"] == "1"
