import pytest
from fastapi import HTTPException

from app.interfaces.api.v1.routers import settings_smoke_router as smoke_router


@pytest.mark.asyncio
@pytest.mark.parametrize(
    (
        "role",
        "summary",
        "history",
        "history_days",
        "include_logs",
        "include_history",
        "expected_history_days",
    ),
    [
        ("admin", False, False, 30, True, True, 30),
        ("admin", True, False, 30, False, False, None),
        ("admin", True, True, 30, False, True, 30),
        ("viewer", True, True, 30, False, False, None),
    ],
)
async def test_get_smoke_rotation_status_skips_admin_details_for_summary(
    monkeypatch,
    role: str,
    summary: bool,
    history: bool,
    history_days: int,
    include_logs: bool,
    include_history: bool,
    expected_history_days: int | None,
):
    calls = []

    async def fake_status_response(_db, **kwargs):
        calls.append(kwargs)
        return object()

    monkeypatch.setattr(smoke_router, "_get_smoke_rotation_status_response", fake_status_response)

    await smoke_router.get_smoke_rotation_status(
        db=object(),
        current_user={"role": role},
        refresh_monitoring_history=True,
        summary=summary,
        history=history,
        history_days=history_days,
    )

    assert calls == [
        {
            "include_recent_logs": include_logs,
            "include_monitoring_history": include_history,
            "monitoring_history_days": expected_history_days,
            "monitoring_history_page": 1,
            "monitoring_history_search": "",
            "monitoring_history_status": "all",
            "monitoring_history_cancellation_reason": "all",
            "force_refresh_monitoring_history": role == "admin" and not summary,
        }
    ]


@pytest.mark.asyncio
async def test_get_smoke_rotation_status_rejects_unsupported_history_days():
    with pytest.raises(HTTPException, match="history_days는 7 또는 30이어야 합니다"):
        await smoke_router.get_smoke_rotation_status(
            db=object(),
            current_user={"role": "admin"},
            history=True,
            history_days=8,
        )


@pytest.mark.asyncio
async def test_get_smoke_rotation_status_rejects_invalid_history_page():
    with pytest.raises(HTTPException, match="history_page는 1 이상이어야 합니다"):
        await smoke_router.get_smoke_rotation_status(
            db=object(),
            current_user={"role": "admin"},
            history=True,
            history_page=0,
        )


@pytest.mark.asyncio
async def test_get_smoke_rotation_status_rejects_invalid_history_filter():
    with pytest.raises(HTTPException, match="history_status 값을 확인해주세요"):
        await smoke_router.get_smoke_rotation_status(
            db=object(),
            current_user={"role": "admin"},
            history=True,
            history_status="skipped",
        )


@pytest.mark.asyncio
async def test_get_smoke_rotation_status_rejects_invalid_cancellation_filter():
    with pytest.raises(HTTPException, match="history_cancellation_reason 값을 확인해주세요"):
        await smoke_router.get_smoke_rotation_status(
            db=object(),
            current_user={"role": "admin"},
            history=True,
            history_status="cancelled",
            history_cancellation_reason="unknown",
        )


@pytest.mark.asyncio
async def test_get_smoke_rotation_status_requires_cancelled_status_for_reason_filter():
    with pytest.raises(HTTPException, match="취소 상태에서만"):
        await smoke_router.get_smoke_rotation_status(
            db=object(),
            current_user={"role": "admin"},
            history=True,
            history_status="all",
            history_cancellation_reason="timeout",
        )


@pytest.mark.asyncio
async def test_get_smoke_rotation_status_blocks_forced_refresh_when_rate_limit_is_low(
    monkeypatch,
):
    message = "GitHub API 잔여량 보호를 위해 수동 새로고침을 잠갔습니다"
    monkeypatch.setattr(
        smoke_router,
        "github_api_manual_refresh_block_message",
        lambda: message,
    )

    with pytest.raises(HTTPException) as exc:
        await smoke_router.get_smoke_rotation_status(
            db=object(),
            current_user={"role": "admin"},
            refresh_monitoring_history=True,
        )

    assert exc.value.status_code == 429
    assert exc.value.detail == message


@pytest.mark.asyncio
async def test_get_smoke_rotation_status_records_new_github_rate_limit_event(monkeypatch):
    rate_limit_event = {
        "kind": "secondary",
        "occurred_at": "2026-07-22T01:00:00+00:00",
        "retry_at": "2026-07-22T01:01:00+00:00",
        "sequence": 3,
    }
    events = iter([None, rate_limit_event])
    recorded = []

    async def fake_status_response(_db, **_kwargs):
        return object()

    async def fake_record_rate_limit_audit(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(smoke_router, "_get_smoke_rotation_status_response", fake_status_response)
    monkeypatch.setattr(smoke_router, "read_github_api_rate_limit_event", lambda: next(events))
    monkeypatch.setattr(
        smoke_router,
        "record_github_api_rate_limit_audit",
        fake_record_rate_limit_audit,
    )

    result = await smoke_router.get_smoke_rotation_status(
        db=object(),
        current_user={"role": "admin", "username": "lizstudio"},
    )

    assert result is not None
    assert recorded[0]["actor"] == "lizstudio"
    assert recorded[0]["rate_limit_event"] == rate_limit_event
