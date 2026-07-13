from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi import FastAPI, Response
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.infrastructure.persistence.models import AuditLogModel
from app.interfaces.api.v1.routers import audit as audit_router
from tests.interfaces.api.audit_router_fakes import make_log


@pytest.fixture
async def audit_db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(AuditLogModel.__table__.create)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
    await engine.dispose()


async def seed_logs(db, logs):
    db.add_all(logs)
    await db.commit()


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
async def test_list_audit_logs_filters_by_event_and_applies_pagination(audit_db):
    now = datetime.now(timezone.utc)
    await seed_logs(
        audit_db,
        [
            make_log(event="login_failure", resource_name="alice", created_at=now - timedelta(minutes=1)),
            make_log(event="login_locked", resource_name="alice", created_at=now - timedelta(minutes=2)),
            make_log(event="login_locked", resource_name="bob", created_at=now - timedelta(minutes=3)),
            make_log(event="service_updated", resource_type="service", resource_name="svc", created_at=now - timedelta(minutes=4)),
        ],
    )

    response = Response()
    result = await audit_router.list_audit_logs(
        response=response,
        limit=1,
        offset=1,
        resource_type=None,
        action=None,
        event="login_locked",
        manager_status=None,
        manager_source=None,
        period_days=None,
        start_date=None,
        end_date=None,
        search=None,
        security_only=False,
        provider=None,
        delivery_success=None,
        db=audit_db,
        _={"username": "admin"},
    )

    assert len(result) == 1
    assert response.headers["x-total-count"] == "2"
    assert result[0].event == "login_locked"
    assert result[0].resource_name == "bob"


@pytest.mark.asyncio
async def test_list_audit_logs_filters_by_resource_type_and_action(audit_db):
    now = datetime.now(timezone.utc)
    await seed_logs(
        audit_db,
        [
            make_log(
                action="update",
                resource_type="settings",
                resource_name="시간 표시 설정",
                event="settings_update_time_display",
                created_at=now - timedelta(minutes=1),
            ),
            make_log(
                action="test",
                resource_type="settings",
                resource_name="Cloudflare 연결 테스트",
                event="settings_test_cloudflare",
                created_at=now - timedelta(minutes=2),
            ),
            make_log(
                action="update",
                resource_type="service",
                resource_name="svc",
                event="service_updated",
                created_at=now - timedelta(minutes=3),
            ),
        ],
    )

    result = await audit_router.list_audit_logs(
        response=Response(),
        limit=10,
        offset=0,
        resource_type="settings",
        action="update",
        event=None,
        manager_status=None,
        manager_source=None,
        period_days=None,
        start_date=None,
        end_date=None,
        search=None,
        security_only=False,
        provider=None,
        delivery_success=None,
        db=audit_db,
        _={"username": "admin"},
    )

    assert len(result) == 1
    assert result[0].resource_type == "settings"
    assert result[0].action == "update"
    assert result[0].event == "settings_update_time_display"


@pytest.mark.asyncio
async def test_list_audit_logs_filters_by_delivery_status_and_provider(audit_db):
    now = datetime.now(timezone.utc)
    await seed_logs(
        audit_db,
        [
            make_log(
                action="alert",
                resource_type="settings",
                resource_name="보안 알림 전송 결과",
                event="security_alert_delivery_success",
                created_at=now - timedelta(minutes=1),
                detail_extra={"success": True, "provider": "slack"},
            ),
            make_log(
                action="alert",
                resource_type="settings",
                resource_name="보안 알림 전송 결과",
                event="security_alert_delivery_failure",
                created_at=now - timedelta(minutes=2),
                detail_extra={"success": False, "provider": "pagerduty"},
            ),
            make_log(
                action="alert",
                resource_type="settings",
                resource_name="운영 변경 알림 전송 결과",
                event="change_alert_delivery_failure",
                created_at=now - timedelta(minutes=3),
                detail_extra={"success": False, "provider": "email"},
            ),
        ],
    )

    result = await audit_router.list_audit_logs(
        response=Response(),
        limit=10,
        offset=0,
        resource_type=None,
        action="alert",
        event=None,
        manager_status=None,
        manager_source=None,
        period_days=None,
        start_date=None,
        end_date=None,
        search=None,
        security_only=False,
        provider="pagerduty",
        delivery_success=False,
        db=audit_db,
        _={"username": "admin"},
    )

    assert len(result) == 1
    assert result[0].event == "security_alert_delivery_failure"
    assert result[0].detail["provider"] == "pagerduty"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("manager_status", "expected_events"),
    [
        ("unhealthy", {"manager_docker_unhealthy", "manager_watchdog_stale"}),
        ("recovered", {"manager_docker_recovered", "manager_watchdog_recovered"}),
    ],
)
async def test_list_audit_logs_filters_manager_status(audit_db, manager_status, expected_events):
    now = datetime.now(timezone.utc)
    await seed_logs(
        audit_db,
        [
            make_log(event=event, resource_type="manager_component", created_at=now)
            for event in expected_events
        ]
        + [make_log(event="service_updated", resource_type="service", created_at=now)],
    )

    result = await audit_router.list_audit_logs(
        response=Response(),
        limit=10,
        offset=0,
        resource_type=None,
        action=None,
        event=None,
        manager_status=manager_status,
        manager_source=None,
        period_days=None,
        start_date=None,
        end_date=None,
        search=None,
        security_only=False,
        provider=None,
        delivery_success=None,
        db=audit_db,
        _={"username": "admin"},
    )

    assert {item.event for item in result} == expected_events


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("manager_source", "expected_events"),
    [
        ("docker", {"manager_docker_unhealthy", "manager_docker_recovered"}),
        ("watchdog", {"manager_watchdog_stale", "manager_watchdog_recovered"}),
    ],
)
async def test_list_audit_logs_filters_manager_source(audit_db, manager_source, expected_events):
    now = datetime.now(timezone.utc)
    all_events = {
        "manager_docker_unhealthy",
        "manager_docker_recovered",
        "manager_watchdog_stale",
        "manager_watchdog_recovered",
    }
    await seed_logs(
        audit_db,
        [
            make_log(event=event, resource_type="manager_component", created_at=now)
            for event in all_events
        ],
    )

    result = await audit_router.list_audit_logs(
        response=Response(),
        limit=10,
        offset=0,
        resource_type=None,
        action=None,
        event=None,
        manager_status=None,
        manager_source=manager_source,
        period_days=None,
        start_date=None,
        end_date=None,
        search=None,
        security_only=False,
        provider=None,
        delivery_success=None,
        db=audit_db,
        _={"username": "admin"},
    )

    assert {item.event for item in result} == expected_events


@pytest.mark.asyncio
@pytest.mark.parametrize("search", ["LIZSTUDIO", "english", "3011"])
async def test_list_audit_logs_searches_actor_and_target(audit_db, search):
    now = datetime.now(timezone.utc)
    await seed_logs(
        audit_db,
        [
            make_log(
                actor="lizstudio",
                resource_id="service-3011",
                resource_name="English Service",
                created_at=now,
            ),
            make_log(actor="viewer", resource_name="다른 서비스", created_at=now),
        ],
    )

    result = await audit_router.list_audit_logs(
        response=Response(),
        limit=10,
        offset=0,
        resource_type=None,
        action=None,
        event=None,
        manager_status=None,
        manager_source=None,
        period_days=None,
        start_date=None,
        end_date=None,
        search=search,
        security_only=False,
        provider=None,
        delivery_success=None,
        db=audit_db,
        _={"username": "admin"},
    )

    assert len(result) == 1
    assert result[0].resource_name == "English Service"


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
