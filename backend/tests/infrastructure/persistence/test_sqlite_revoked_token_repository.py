from datetime import datetime, timedelta, timezone

import pytest

from app.domain.auth.entities.revoked_token import RevokedToken
from app.infrastructure.persistence.models import RevokedTokenModel
from app.infrastructure.persistence.repositories.sqlite_revoked_token_repository import (
    SQLiteRevokedTokenRepository,
)


class StubAsyncSession:
    def __init__(self, existing=None):
        self.existing = existing
        self.added = None

    async def get(self, _model, key):
        if self.existing and self.existing.jti == key:
            return self.existing
        return None

    def add(self, model):
        self.added = model


@pytest.mark.asyncio
async def test_save_persists_revoked_token_on_insert():
    session = StubAsyncSession()
    repository = SQLiteRevokedTokenRepository(session)
    revoked_token = RevokedToken.revoke(
        jti="token-jti-1",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
        username="admin",
    )

    await repository.save(revoked_token)

    assert session.added is not None
    assert session.added.jti == "token-jti-1"
    assert session.added.username == "admin"


@pytest.mark.asyncio
async def test_is_revoked_returns_true_for_existing_token():
    existing = RevokedTokenModel(
        jti="token-jti-1",
        username="admin",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
        revoked_at=datetime.now(timezone.utc),
    )
    session = StubAsyncSession(existing=existing)
    repository = SQLiteRevokedTokenRepository(session)

    assert await repository.is_revoked("token-jti-1") is True


@pytest.mark.asyncio
async def test_is_revoked_returns_false_for_missing_token():
    repository = SQLiteRevokedTokenRepository(StubAsyncSession())

    assert await repository.is_revoked("missing-token") is False
