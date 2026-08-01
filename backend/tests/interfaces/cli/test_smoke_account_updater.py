import json
from types import SimpleNamespace

from app.interfaces.cli import smoke_account_updater


class StubResponse:
    def __init__(self, payload: dict | None = None):
        self.body = json.dumps(payload or {}).encode()

    def __enter__(self):
        return self

    def __exit__(self, *_args) -> None:
        return None

    def read(self) -> bytes:
        return self.body


class StubOpener:
    def __init__(self):
        self.requests = []

    def open(self, request):
        self.requests.append(request)
        if request.full_url.endswith("/auth/login"):
            return StubResponse()
        if request.full_url.endswith("/users") and request.get_method() == "GET":
            return StubResponse({"users": [{"id": "user-id", "username": "smoke"}]})
        return StubResponse({"username": "smoke", "role": "viewer", "is_active": True})


def test_update_smoke_account_reuses_existing_user(monkeypatch) -> None:
    opener = StubOpener()
    cookies = [
        SimpleNamespace(name="tm_session", value="session"),
        SimpleNamespace(name="tm_csrf", value="csrf"),
    ]
    monkeypatch.setattr(smoke_account_updater, "CookieJar", lambda: cookies)
    monkeypatch.setattr(smoke_account_updater, "build_opener", lambda *_args: opener)

    user = smoke_account_updater.update_smoke_account(
        username="smoke",
        role="viewer",
        password="secret",
    )

    update_request = opener.requests[-1]
    assert update_request.get_method() == "PUT"
    assert update_request.full_url.endswith("/users/user-id")
    assert update_request.headers["X-csrf-token"] == "csrf"
    assert json.loads(update_request.data) == {
        "username": "smoke",
        "password": "secret",
        "role": "viewer",
        "is_active": True,
    }
    assert user["is_active"] is True
