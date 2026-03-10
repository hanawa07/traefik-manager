from datetime import datetime, timedelta, timezone

import pytest

from app.interfaces.api.v1.routers import auth as auth_router


class StubRevokedTokenRepository:
    def __init__(self):
        self.saved_tokens = []

    async def save(self, token) -> None:
        self.saved_tokens.append(token)


@pytest.mark.asyncio
async def test_logout_revokes_current_token(monkeypatch):
    repository = StubRevokedTokenRepository()
    monkeypatch.setattr(
        auth_router,
        "SQLiteRevokedTokenRepository",
        lambda _db: repository,
        raising=False,
    )

    await auth_router.logout(
        current_user={
            "username": "admin",
            "token_jti": "token-jti-1",
            "token_exp": datetime.now(timezone.utc) + timedelta(minutes=30),
        },
        db=object(),
    )

    assert len(repository.saved_tokens) == 1
    assert repository.saved_tokens[0].jti == "token-jti-1"
    assert repository.saved_tokens[0].username == "admin"
