from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from starlette.responses import Response

from app.interfaces.api.v1.routers import auth as auth_router
from tests.interfaces.api.auth_router_fakes import (
    StubAuthSessionRepository,
    StubAuthUseCases,
    authenticated_result,
    failed_auth_result,
    make_request,
    make_user,
    stub_default_system_settings,
    stub_no_suspicious_ip_block,
    stub_session_credentials,
    stub_turnstile_risk,
    stub_turnstile_verifier,
)


@pytest.mark.asyncio
async def test_get_login_protection_returns_turnstile_public_settings(monkeypatch):
    stub_default_system_settings(
        monkeypatch,
        {
            "login_turnstile_mode": "always",
            "login_turnstile_enabled": "true",
            "login_turnstile_site_key": "0x4AAAAA-example-site-key",
            "login_turnstile_secret_key": "turnstile-secret",
        },
    )

    response = await auth_router.get_login_protection(
        request=make_request(path="/api/v1/auth/login-protection", method="GET"),
        db=object(),
    )

    assert response.turnstile_mode == "always"
    assert response.turnstile_enabled is True
    assert response.turnstile_required is True
    assert response.turnstile_site_key == "0x4AAAAA-example-site-key"


@pytest.mark.asyncio
async def test_get_login_protection_returns_required_false_for_risk_based_without_recent_failures(monkeypatch):
    risk_calls = []
    stub_default_system_settings(
        monkeypatch,
        {
            "login_turnstile_mode": "risk_based",
            "login_turnstile_enabled": "true",
            "login_turnstile_site_key": "0x4AAAAA-example-site-key",
            "login_turnstile_secret_key": "turnstile-secret",
        },
    )
    stub_turnstile_risk(monkeypatch, False, risk_calls)

    response = await auth_router.get_login_protection(
        request=make_request(path="/api/v1/auth/login-protection", method="GET"),
        db=object(),
    )

    assert response.turnstile_mode == "risk_based"
    assert response.turnstile_enabled is True
    assert response.turnstile_required is False
    assert risk_calls[0]["client_ip"] == "127.0.0.1"


@pytest.mark.asyncio
async def test_login_requires_turnstile_token_when_enabled(monkeypatch):
    use_cases = StubAuthUseCases(failed_auth_result())
    stub_default_system_settings(
        monkeypatch,
        {
            "login_turnstile_mode": "always",
            "login_turnstile_enabled": "true",
            "login_turnstile_site_key": "0x4AAAAA-example-site-key",
            "login_turnstile_secret_key": "turnstile-secret",
        },
    )
    stub_no_suspicious_ip_block(monkeypatch)

    with pytest.raises(HTTPException) as exc_info:
        await auth_router.login(
            request=make_request(headers={"user-agent": "pytest-browser/1.0"}),
            response=Response(),
            form=SimpleNamespace(username="admin", password="correct-password"),
            use_cases=use_cases,
            db=object(),
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "추가 로그인 검증에 실패했습니다"
    assert use_cases.calls == []


@pytest.mark.asyncio
async def test_login_verifies_turnstile_token_when_enabled(monkeypatch):
    user = make_user(token_version=4)
    repository = StubAuthSessionRepository()
    response = Response()
    verify_calls = []

    stub_session_credentials(monkeypatch, repository)
    stub_default_system_settings(
        monkeypatch,
        {
            "login_turnstile_mode": "always",
            "login_turnstile_enabled": "true",
            "login_turnstile_site_key": "0x4AAAAA-example-site-key",
            "login_turnstile_secret_key": "turnstile-secret",
        },
    )
    stub_no_suspicious_ip_block(monkeypatch)
    stub_turnstile_verifier(monkeypatch, True, verify_calls)

    request = make_request(
        headers={
            "user-agent": "pytest-browser/1.0",
            "content-type": "application/x-www-form-urlencoded",
        }
    )
    request._form = {
        "cf-turnstile-response": "turnstile-token-123",
    }

    result = await auth_router.login(
        request=request,
        response=response,
        form=SimpleNamespace(username="admin", password="correct-password"),
        use_cases=StubAuthUseCases(authenticated_result(user)),
        db=object(),
    )

    assert result["username"] == "admin"
    assert verify_calls[0]["token"] == "turnstile-token-123"
    assert verify_calls[0]["secret_key"] == "turnstile-secret"
    assert verify_calls[0]["remote_ip"] == "127.0.0.1"


@pytest.mark.asyncio
async def test_login_skips_turnstile_when_risk_based_mode_not_required(monkeypatch):
    user = make_user(token_version=4)
    repository = StubAuthSessionRepository()
    response = Response()
    risk_calls = []
    verify_calls = []

    stub_session_credentials(monkeypatch, repository)
    stub_default_system_settings(
        monkeypatch,
        {
            "login_turnstile_mode": "risk_based",
            "login_turnstile_enabled": "true",
            "login_turnstile_site_key": "0x4AAAAA-example-site-key",
            "login_turnstile_secret_key": "turnstile-secret",
        },
    )
    stub_no_suspicious_ip_block(monkeypatch)
    stub_turnstile_risk(monkeypatch, False, risk_calls)
    stub_turnstile_verifier(monkeypatch, True, verify_calls)

    result = await auth_router.login(
        request=make_request(headers={"user-agent": "pytest-browser/1.0"}),
        response=response,
        form=SimpleNamespace(username="admin", password="correct-password"),
        use_cases=StubAuthUseCases(authenticated_result(user)),
        db=object(),
    )

    assert result["username"] == "admin"
    assert risk_calls[0]["client_ip"] == "127.0.0.1"
    assert verify_calls == []


@pytest.mark.asyncio
async def test_login_requires_turnstile_when_risk_based_mode_is_required(monkeypatch):
    use_cases = StubAuthUseCases(failed_auth_result())
    stub_default_system_settings(
        monkeypatch,
        {
            "login_turnstile_mode": "risk_based",
            "login_turnstile_enabled": "true",
            "login_turnstile_site_key": "0x4AAAAA-example-site-key",
            "login_turnstile_secret_key": "turnstile-secret",
        },
    )
    stub_no_suspicious_ip_block(monkeypatch)
    stub_turnstile_risk(monkeypatch, True)

    with pytest.raises(HTTPException) as exc_info:
        await auth_router.login(
            request=make_request(headers={"user-agent": "pytest-browser/1.0"}),
            response=Response(),
            form=SimpleNamespace(username="admin", password="correct-password"),
            use_cases=use_cases,
            db=object(),
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "추가 로그인 검증에 실패했습니다"
    assert use_cases.calls == []
