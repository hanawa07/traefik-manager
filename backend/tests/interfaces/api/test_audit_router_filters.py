from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI, Response
from httpx import ASGITransport, AsyncClient

from app.interfaces.api.v1.routers import audit as audit_router
from tests.interfaces.api.audit_router_fakes import make_log, seed_logs


async def _list_audit_logs(audit_db, *, response: Response | None = None, **overrides):
    query = {
        "limit": 10,
        "offset": 0,
        "resource_type": None,
        "action": None,
        "event": None,
        "manager_status": None,
        "manager_source": None,
        "period_days": None,
        "start_date": None,
        "end_date": None,
        "search": None,
        "security_only": False,
        "provider": None,
        "delivery_success": None,
    }
    query.update(overrides)
    return await audit_router.list_audit_logs(
        response=response if response is not None else Response(),
        db=audit_db,
        _={"username": "admin"},
        **query,
    )


@pytest.mark.asyncio
async def test_list_audit_logs_accepts_api_manager_source_from_http_query(audit_db):
    now = datetime.now(timezone.utc)
    await seed_logs(
        audit_db,
        [
            make_log(
                event="manager_http_errors_high",
                resource_type="manager_component",
                created_at=now,
            ),
            make_log(
                event="manager_docker_unhealthy",
                resource_type="manager_component",
                created_at=now,
            ),
        ],
    )
    app = FastAPI()
    app.include_router(audit_router.router, prefix="/audit")
    app.dependency_overrides[audit_router.get_db] = lambda: audit_db
    app.dependency_overrides[audit_router.get_current_user] = lambda: {"username": "admin"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/audit", params={"manager_source": "api"})
        invalid_response = await client.get("/audit", params={"manager_source": "http"})

    assert response.status_code == 200
    assert [item["event"] for item in response.json()] == ["manager_http_errors_high"]
    assert invalid_response.status_code == 422


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
    result = await _list_audit_logs(
        audit_db,
        response=response,
        limit=1,
        offset=1,
        event="login_locked",
    )

    assert len(result) == 1
    assert response.headers["x-total-count"] == "2"
    assert result[0].event == "login_locked"
    assert result[0].resource_name == "bob"


@pytest.mark.asyncio
async def test_list_audit_logs_groups_github_api_rate_limit_events(audit_db):
    now = datetime.now(timezone.utc)
    await seed_logs(
        audit_db,
        [
            make_log(event="github_api_primary_rate_limit", created_at=now),
            make_log(event="github_api_secondary_rate_limit", created_at=now),
            make_log(event="service_updated", created_at=now),
        ],
    )

    response = Response()
    result = await _list_audit_logs(
        audit_db,
        response=response,
        event="github_api_rate_limit",
    )

    assert response.headers["x-total-count"] == "2"
    assert {item.event for item in result} == {
        "github_api_primary_rate_limit",
        "github_api_secondary_rate_limit",
    }


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

    result = await _list_audit_logs(
        audit_db,
        resource_type="settings",
        action="update",
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

    result = await _list_audit_logs(
        audit_db,
        action="alert",
        provider="pagerduty",
        delivery_success=False,
    )

    assert len(result) == 1
    assert result[0].event == "security_alert_delivery_failure"
    assert result[0].detail["provider"] == "pagerduty"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("manager_status", "expected_events"),
    [
        (
            "unhealthy",
            {
                "manager_docker_unhealthy",
                "manager_http_errors_high",
                "manager_http_log_storage_warning",
                "manager_deployment_bottleneck_storage_warning",
                "manager_watchdog_stale",
            },
        ),
        (
            "recovered",
            {
                "manager_docker_recovered",
                "manager_http_errors_recovered",
                "manager_http_log_storage_recovered",
                "manager_deployment_bottleneck_storage_recovered",
                "manager_watchdog_recovered",
            },
        ),
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

    result = await _list_audit_logs(
        audit_db,
        manager_status=manager_status,
    )

    assert {item.event for item in result} == expected_events


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("manager_source", "expected_events"),
    [
        ("docker", {"manager_docker_unhealthy", "manager_docker_recovered"}),
        (
            "api",
            {
                "manager_http_errors_high",
                "manager_http_errors_recovered",
                "manager_http_log_storage_warning",
                "manager_http_log_storage_recovered",
                "manager_deployment_bottleneck_storage_warning",
                "manager_deployment_bottleneck_storage_recovered",
            },
        ),
        ("watchdog", {"manager_watchdog_stale", "manager_watchdog_recovered"}),
    ],
)
async def test_list_audit_logs_filters_manager_source(audit_db, manager_source, expected_events):
    now = datetime.now(timezone.utc)
    all_events = {
        "manager_docker_unhealthy",
        "manager_docker_recovered",
        "manager_http_errors_high",
        "manager_http_errors_recovered",
        "manager_http_log_storage_warning",
        "manager_http_log_storage_recovered",
        "manager_deployment_bottleneck_storage_warning",
        "manager_deployment_bottleneck_storage_recovered",
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

    result = await _list_audit_logs(
        audit_db,
        manager_source=manager_source,
    )

    assert {item.event for item in result} == expected_events


@pytest.mark.asyncio
async def test_list_audit_logs_searches_id_actor_and_target(audit_db):
    now = datetime.now(timezone.utc)
    target = make_log(
        actor="lizstudio",
        resource_id="service-3011",
        resource_name="English Service",
        created_at=now,
    )
    await seed_logs(
        audit_db,
        [
            target,
            make_log(actor="viewer", resource_name="다른 서비스", created_at=now),
        ],
    )

    for search in [target.id, "LIZSTUDIO", "english", "3011"]:
        result = await _list_audit_logs(
            audit_db,
            search=search,
        )

        assert len(result) == 1
        assert result[0].resource_name == "English Service"
