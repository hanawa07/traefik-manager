from datetime import timedelta
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from starlette.responses import Response

from app.interfaces.api.v1.routers import auth as auth_router
from tests.interfaces.api.auth_router_fakes import (
    StubAuthSessionRepository,
    StubAuthUseCases,
    StubSystemSettingsRepository,
    authenticated_result,
    failed_auth_result,
    make_request,
    make_user,
    stub_default_system_settings,
    stub_no_suspicious_ip_block,
    stub_session_credentials,
)


@pytest.mark.asyncio
async def test_login_sets_session_and_csrf_cookies(monkeypatch):
    user = make_user(token_version=4)
    repository = StubAuthSessionRepository()
    response = Response()

    stub_session_credentials(monkeypatch, repository)
    stub_default_system_settings(monkeypatch)
    stub_no_suspicious_ip_block(monkeypatch)

    result = await auth_router.login(
        request=make_request(headers={"user-agent": "pytest-browser/1.0"}),
        response=response,
        form=SimpleNamespace(username="admin", password="correct-password"),
        use_cases=StubAuthUseCases(authenticated_result(user)),
        db=object(),
    )

    set_cookie_headers = response.headers.getlist("set-cookie")

    assert result["username"] == "admin"
    assert result["role"] == "admin"
    assert "access_token" not in result
    assert any("tm_session=session-1.secret-1" in value for value in set_cookie_headers)
    assert any("tm_csrf=csrf-token-1" in value for value in set_cookie_headers)
    assert repository.saved_sessions[0].id == "session-1"
    assert repository.saved_sessions[0].token_version == 4


@pytest.mark.asyncio
async def test_login_failure_returns_generic_401_and_records_audit(monkeypatch):
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    async def fake_detector(**_kwargs):
        return False

    monkeypatch.setattr(auth_router.audit_service, "record", fake_record, raising=False)
    monkeypatch.setattr(
        auth_router.login_anomaly_service,
        "record_suspicious_login_activity_if_needed",
        fake_detector,
        raising=False,
    )
    stub_default_system_settings(monkeypatch)
    stub_no_suspicious_ip_block(monkeypatch)

    with pytest.raises(HTTPException) as exc_info:
        await auth_router.login(
            request=make_request(headers={"user-agent": "pytest-browser/1.0"}),
            response=Response(),
            form=SimpleNamespace(username="admin", password="wrong-password"),
            use_cases=StubAuthUseCases(failed_auth_result()),
            db=object(),
        )

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "아이디 또는 비밀번호가 올바르지 않습니다"
    assert recorded[0]["resource_type"] == "user"
    assert recorded[0]["resource_name"] == "admin"
    assert recorded[0]["detail"]["event"] == "login_failure"


@pytest.mark.asyncio
async def test_login_locked_user_returns_generic_401_and_records_lock(monkeypatch):
    user = make_user(token_version=0)
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    async def fake_detector(**_kwargs):
        return False

    monkeypatch.setattr(auth_router.audit_service, "record", fake_record, raising=False)
    monkeypatch.setattr(
        auth_router.login_anomaly_service,
        "record_suspicious_login_activity_if_needed",
        fake_detector,
        raising=False,
    )
    stub_default_system_settings(monkeypatch)
    stub_no_suspicious_ip_block(monkeypatch)

    with pytest.raises(HTTPException) as exc_info:
        await auth_router.login(
            request=make_request(headers={"user-agent": "pytest-browser/1.0"}),
            response=Response(),
            form=SimpleNamespace(username="admin", password="correct-password"),
            use_cases=StubAuthUseCases(
                failed_auth_result(
                    subject_user=user,
                    failure_reason="locked",
                    locked_until=user.updated_at + timedelta(minutes=15),
                )
            ),
            db=object(),
        )

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "아이디 또는 비밀번호가 올바르지 않습니다"
    assert recorded[0]["detail"]["event"] == "login_locked"


@pytest.mark.asyncio
async def test_login_failure_invokes_suspicious_login_detector(monkeypatch):
    recorded = []
    detector_calls = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    async def fake_detector(**kwargs):
        detector_calls.append(kwargs)
        return False

    monkeypatch.setattr(auth_router.audit_service, "record", fake_record, raising=False)
    monkeypatch.setattr(
        auth_router.login_anomaly_service,
        "record_suspicious_login_activity_if_needed",
        fake_detector,
        raising=False,
    )
    stub_default_system_settings(monkeypatch)
    stub_no_suspicious_ip_block(monkeypatch)

    with pytest.raises(HTTPException):
        await auth_router.login(
            request=make_request(headers={"user-agent": "pytest-browser/1.0"}),
            response=Response(),
            form=SimpleNamespace(username="admin", password="wrong-password"),
            use_cases=StubAuthUseCases(failed_auth_result()),
            db=object(),
        )

    assert recorded[0]["detail"]["event"] == "login_failure"
    assert detector_calls[0]["client_ip"] == "127.0.0.1"


@pytest.mark.asyncio
async def test_login_blocks_suspicious_ip_before_authentication(monkeypatch):
    use_cases = StubAuthUseCases(failed_auth_result())

    async def fake_blocker(**_kwargs):
        return True

    monkeypatch.setattr(
        auth_router.login_anomaly_service,
        "enforce_suspicious_ip_block_if_needed",
        fake_blocker,
        raising=False,
    )
    stub_default_system_settings(monkeypatch)

    with pytest.raises(HTTPException) as exc_info:
        await auth_router.login(
            request=make_request(headers={"user-agent": "pytest-browser/1.0"}),
            response=Response(),
            form=SimpleNamespace(username="admin", password="correct-password"),
            use_cases=use_cases,
            db=object(),
        )

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "아이디 또는 비밀번호가 올바르지 않습니다"
    assert use_cases.calls == []


@pytest.mark.asyncio
async def test_login_passes_trusted_network_policy_to_suspicious_blocker(monkeypatch):
    user = make_user(token_version=4)
    repository = StubAuthSessionRepository()
    response = Response()
    blocker_calls = []

    async def fake_blocker(**kwargs):
        blocker_calls.append(kwargs)
        return False

    StubSystemSettingsRepository.values = {
        "login_suspicious_block_enabled": "false",
        "login_suspicious_trusted_networks": "10.0.0.0/8\n203.0.113.10/32",
        "login_suspicious_block_escalation_enabled": "true",
        "login_suspicious_block_escalation_window_minutes": "720",
        "login_suspicious_block_escalation_multiplier": "3",
        "login_suspicious_block_max_minutes": "2880",
    }
    stub_session_credentials(monkeypatch, repository)
    stub_default_system_settings(monkeypatch, StubSystemSettingsRepository.values)
    monkeypatch.setattr(
        auth_router.login_anomaly_service,
        "enforce_suspicious_ip_block_if_needed",
        fake_blocker,
        raising=False,
    )

    await auth_router.login(
        request=make_request(headers={"user-agent": "pytest-browser/1.0"}),
        response=response,
        form=SimpleNamespace(username="admin", password="correct-password"),
        use_cases=StubAuthUseCases(authenticated_result(user)),
        db=object(),
    )

    assert blocker_calls[0]["block_enabled"] is False
    assert blocker_calls[0]["trusted_networks"] == ["10.0.0.0/8", "203.0.113.10/32"]
    assert blocker_calls[0]["escalation_enabled"] is True
    assert blocker_calls[0]["escalation_window"] == timedelta(minutes=720)
    assert blocker_calls[0]["escalation_multiplier"] == 3
    assert blocker_calls[0]["max_block_window"] == timedelta(minutes=2880)
