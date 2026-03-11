from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.domain.auth.entities.auth_session import AuthSession
from app.infrastructure.persistence.models import AuthSessionModel
from app.infrastructure.persistence.repositories.sqlite_auth_session_repository import (
    SQLiteAuthSessionRepository,
)


class StubAsyncSession:
    def __init__(self, existing=None):
        self.existing = existing
        self.added = None

    async def get(self, _model, key):
        if self.existing and self.existing.id == key:
            return self.existing
        return None

    def add(self, model):
        self.added = model


@pytest.mark.asyncio
async def test_save_persists_auth_session_on_insert():
    session = StubAsyncSession()
    repository = SQLiteAuthSessionRepository(session)
    auth_session = AuthSession.issue(
        session_id="session-1",
        session_secret_hash="hash-1",
        user_id=str(uuid4()),
        username="admin",
        role="admin",
        token_version=3,
        absolute_ttl=timedelta(hours=8),
        idle_ttl=timedelta(hours=1),
        now=datetime.now(timezone.utc),
        ip_address="192.168.0.10",
        user_agent="pytest",
    )

    await repository.save(auth_session)

    assert session.added is not None
    assert session.added.id == "session-1"
    assert session.added.username == "admin"
    assert session.added.session_secret_hash == "hash-1"
    assert session.added.token_version == 3


def test_to_entity_restores_auth_session():
    now = datetime.now(timezone.utc)
    model = AuthSessionModel(
        id="session-1",
        user_id=str(uuid4()),
        username="admin",
        role="admin",
        token_version=2,
        session_secret_hash="hash-1",
        issued_at=now,
        last_seen_at=now,
        expires_at=now + timedelta(hours=8),
        idle_expires_at=now + timedelta(hours=1),
        revoked_at=None,
        revoked_reason=None,
        ip_address="10.0.0.1",
        user_agent="pytest",
    )

    repository = SQLiteAuthSessionRepository(None)
    auth_session = repository._to_entity(model)

    assert auth_session.id == "session-1"
    assert auth_session.username == "admin"
    assert auth_session.token_version == 2
    assert auth_session.ip_address == "10.0.0.1"


def test_to_entity_normalizes_naive_datetimes_to_utc():
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    model = AuthSessionModel(
        id="session-1",
        user_id=str(uuid4()),
        username="admin",
        role="admin",
        token_version=2,
        session_secret_hash="hash-1",
        issued_at=now,
        last_seen_at=now,
        expires_at=now + timedelta(hours=8),
        idle_expires_at=now + timedelta(hours=1),
        revoked_at=None,
        revoked_reason=None,
        ip_address="10.0.0.1",
        user_agent="pytest",
    )

    repository = SQLiteAuthSessionRepository(None)
    auth_session = repository._to_entity(model)

    assert auth_session.issued_at.tzinfo == timezone.utc
    assert auth_session.expires_at.tzinfo == timezone.utc
    assert auth_session.idle_expires_at.tzinfo == timezone.utc
