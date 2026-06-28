from types import SimpleNamespace

from app.interfaces.api.v1.routers import settings as settings_router
from tests.interfaces.api.settings_router_fakes import StubSettingsRepository


ADMIN = {"role": "admin"}
ADMIN_USER = {"role": "admin", "username": "admin"}


def patch_settings_repository(monkeypatch, store: dict[str, str] | None = None) -> None:
    StubSettingsRepository.store = dict(store or {})
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)


def make_http_request():
    return SimpleNamespace(headers={}, client=SimpleNamespace(host="127.0.0.1"))


def capture_audit_records(monkeypatch, client_ip: str = "198.51.100.7"):
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(settings_router.audit_service, "record", fake_record, raising=False)
    monkeypatch.setattr(settings_router, "get_client_ip", lambda _request: client_ip)
    return recorded


def patch_test_alert_sender(monkeypatch, result: dict[str, object]):
    called = {}

    async def fake_send_test_alert(db):
        called["db"] = db
        return result

    monkeypatch.setattr(settings_router.security_alert_notifier, "send_test_alert", fake_send_test_alert)
    return called
