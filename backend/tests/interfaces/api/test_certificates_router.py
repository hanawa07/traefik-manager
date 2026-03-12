import pytest

from app.interfaces.api.v1.routers import certificates as certificates_router


@pytest.mark.asyncio
async def test_check_certificates_returns_summary(monkeypatch):
    async def fake_check_certificate_alerts_once(**_kwargs):
        return {
            "checked_at": "2026-03-12T04:30:00+00:00",
            "total_count": 3,
            "warning_count": 1,
            "error_count": 1,
            "recorded_event_count": 1,
        }

    monkeypatch.setattr(
        certificates_router,
        "check_certificate_alerts_once",
        fake_check_certificate_alerts_once,
    )

    result = await certificates_router.check_certificates(
        traefik_client=object(),
        _={"role": "admin"},
    )

    assert result["total_count"] == 3
    assert result["warning_count"] == 1
    assert result["error_count"] == 1
    assert result["recorded_event_count"] == 1
