import pytest
from pydantic import ValidationError

from app.interfaces.api.v1.routers import settings as settings_router
from app.interfaces.api.v1.schemas.settings_schemas import LoginDefenseSettingsUpdateRequest
from tests.interfaces.api.settings_router_fakes import StubSettingsRepository


@pytest.mark.asyncio
async def test_get_login_defense_settings_returns_defaults(monkeypatch):
    StubSettingsRepository.store = {}
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)

    response = await settings_router.get_login_defense_settings(db=object(), _={"role": "admin"})

    assert response.suspicious_block_enabled is True
    assert response.suspicious_trusted_networks == []
    assert response.suspicious_block_minutes == 30
    assert response.suspicious_block_escalation_enabled is False
    assert response.suspicious_block_escalation_window_minutes == 1440
    assert response.suspicious_block_escalation_multiplier == 2
    assert response.suspicious_block_max_minutes == 1440
    assert response.failure_window_minutes == 15
    assert response.turnstile_mode == "off"
    assert response.turnstile_enabled is False
    assert response.turnstile_site_key is None
    assert response.turnstile_secret_key_configured is False


@pytest.mark.asyncio
async def test_update_login_defense_settings_persists_values(monkeypatch):
    StubSettingsRepository.store = {}
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)

    response = await settings_router.update_login_defense_settings(
        request=LoginDefenseSettingsUpdateRequest(
            suspicious_block_enabled=False,
            suspicious_trusted_networks=["10.0.0.0/8", "203.0.113.10/32"],
            suspicious_block_escalation_enabled=True,
            suspicious_block_escalation_window_minutes=720,
            suspicious_block_escalation_multiplier=3,
            suspicious_block_max_minutes=2880,
            turnstile_mode="always",
            turnstile_site_key=" 0x4AAAAA-example-site-key ",
            turnstile_secret_key=" secret-turnstile-key ",
        ),
        db=object(),
        _={"role": "admin"},
    )

    assert StubSettingsRepository.store["login_turnstile_mode"] == "always"
    assert StubSettingsRepository.store["login_suspicious_block_enabled"] == "false"
    assert StubSettingsRepository.store["login_suspicious_trusted_networks"] == "10.0.0.0/8\n203.0.113.10/32"
    assert StubSettingsRepository.store["login_suspicious_block_escalation_enabled"] == "true"
    assert StubSettingsRepository.store["login_suspicious_block_escalation_window_minutes"] == "720"
    assert StubSettingsRepository.store["login_suspicious_block_escalation_multiplier"] == "3"
    assert StubSettingsRepository.store["login_suspicious_block_max_minutes"] == "2880"
    assert StubSettingsRepository.store["login_turnstile_enabled"] == "true"
    assert StubSettingsRepository.store["login_turnstile_site_key"] == "0x4AAAAA-example-site-key"
    assert StubSettingsRepository.store["login_turnstile_secret_key"] == "secret-turnstile-key"
    assert response.suspicious_block_enabled is False
    assert response.suspicious_trusted_networks == ["10.0.0.0/8", "203.0.113.10/32"]
    assert response.suspicious_block_escalation_enabled is True
    assert response.suspicious_block_escalation_window_minutes == 720
    assert response.suspicious_block_escalation_multiplier == 3
    assert response.suspicious_block_max_minutes == 2880
    assert response.turnstile_mode == "always"
    assert response.turnstile_enabled is True
    assert response.turnstile_site_key == "0x4AAAAA-example-site-key"
    assert response.turnstile_secret_key_configured is True


@pytest.mark.asyncio
async def test_update_login_defense_settings_keeps_existing_turnstile_secret(monkeypatch):
    StubSettingsRepository.store = {
        "login_turnstile_mode": "always",
        "login_turnstile_enabled": "true",
        "login_turnstile_site_key": "0x4AAAAA-existing-site-key",
        "login_turnstile_secret_key": "existing-secret",
    }
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)

    response = await settings_router.update_login_defense_settings(
        request=LoginDefenseSettingsUpdateRequest(
            suspicious_block_enabled=True,
            suspicious_trusted_networks=[],
            turnstile_mode="always",
            turnstile_site_key="0x4AAAAA-new-site-key",
            turnstile_secret_key="",
        ),
        db=object(),
        _={"role": "admin"},
    )

    assert StubSettingsRepository.store["login_turnstile_secret_key"] == "existing-secret"
    assert StubSettingsRepository.store["login_turnstile_mode"] == "always"
    assert response.turnstile_site_key == "0x4AAAAA-new-site-key"
    assert response.turnstile_secret_key_configured is True


@pytest.mark.asyncio
async def test_get_login_defense_settings_uses_legacy_turnstile_flag_when_mode_missing(monkeypatch):
    StubSettingsRepository.store = {
        "login_turnstile_enabled": "true",
        "login_turnstile_site_key": "0x4AAAAA-existing-site-key",
        "login_turnstile_secret_key": "existing-secret",
    }
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)

    response = await settings_router.get_login_defense_settings(db=object(), _={"role": "admin"})

    assert response.turnstile_mode == "always"
    assert response.turnstile_enabled is True


@pytest.mark.asyncio
async def test_update_login_defense_settings_persists_risk_based_mode(monkeypatch):
    StubSettingsRepository.store = {}
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)

    response = await settings_router.update_login_defense_settings(
        request=LoginDefenseSettingsUpdateRequest(
            suspicious_block_enabled=True,
            suspicious_trusted_networks=[],
            turnstile_mode="risk_based",
            turnstile_site_key="0x4AAAAA-risk-site-key",
            turnstile_secret_key="risk-secret-key",
        ),
        db=object(),
        _={"role": "admin"},
    )

    assert StubSettingsRepository.store["login_turnstile_mode"] == "risk_based"
    assert StubSettingsRepository.store["login_turnstile_enabled"] == "true"
    assert response.turnstile_mode == "risk_based"
    assert response.turnstile_enabled is True


def test_login_defense_settings_update_request_normalizes_trusted_networks():
    request = LoginDefenseSettingsUpdateRequest(
        suspicious_block_enabled=True,
        suspicious_trusted_networks=[" 10.0.0.0/8 ", "203.0.113.10", "2001:db8::/64"],
        suspicious_block_escalation_enabled=True,
        suspicious_block_escalation_window_minutes=720,
        suspicious_block_escalation_multiplier=3,
        suspicious_block_max_minutes=2880,
        turnstile_mode="risk_based",
    )

    assert request.suspicious_trusted_networks == ["10.0.0.0/8", "203.0.113.10/32", "2001:db8::/64"]


def test_login_defense_settings_update_request_rejects_invalid_trusted_network():
    with pytest.raises(ValidationError):
        LoginDefenseSettingsUpdateRequest(
            suspicious_block_enabled=True,
            suspicious_trusted_networks=["bad-network"],
        )


def test_login_defense_settings_update_request_rejects_invalid_turnstile_mode():
    with pytest.raises(ValidationError):
        LoginDefenseSettingsUpdateRequest(
            suspicious_block_enabled=True,
            suspicious_trusted_networks=[],
            turnstile_mode="sometimes",
        )


def test_login_defense_settings_update_request_rejects_invalid_escalation_multiplier():
    with pytest.raises(ValidationError):
        LoginDefenseSettingsUpdateRequest(
            suspicious_block_enabled=True,
            suspicious_trusted_networks=[],
            suspicious_block_escalation_enabled=True,
            suspicious_block_escalation_window_minutes=720,
            suspicious_block_escalation_multiplier=1,
            suspicious_block_max_minutes=1440,
        )
