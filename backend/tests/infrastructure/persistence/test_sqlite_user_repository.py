from datetime import datetime, timezone
from uuid import uuid4

import pytest

from app.domain.proxy.entities.user import User
from app.infrastructure.persistence.models import UserModel
from app.infrastructure.persistence.repositories.sqlite_user_repository import SQLiteUserRepository


class StubAsyncSession:
    def __init__(self):
        self.added = None

    async def get(self, *_args, **_kwargs):
        return None

    def add(self, model):
        self.added = model


@pytest.mark.asyncio
async def test_save_persists_login_failure_fields_on_insert():
    now = datetime.now(timezone.utc)
    session = StubAsyncSession()
    repository = SQLiteUserRepository(session)
    user = User(
        id=uuid4(),
        username="admin",
        hashed_password="hashed",
        role="admin",
        is_active=True,
        token_version=0,
        created_at=now,
        updated_at=now,
        failed_login_attempts=2,
        last_failed_login_at=now,
        locked_until=now,
    )

    await repository.save(user)

    assert session.added is not None
    assert session.added.failed_login_attempts == 2
    assert session.added.last_failed_login_at == now
    assert session.added.locked_until == now


def test_to_entity_restores_login_failure_fields():
    now = datetime.now(timezone.utc)
    model = UserModel(
        id=str(uuid4()),
        username="admin",
        hashed_password="hashed",
        role="admin",
        is_active=True,
        token_version=0,
        failed_login_attempts=3,
        last_failed_login_at=now,
        locked_until=now,
        created_at=now,
        updated_at=now,
    )

    repository = SQLiteUserRepository(None)
    user = repository._to_entity(model)

    assert user.failed_login_attempts == 3
    assert user.last_failed_login_at == now
    assert user.locked_until == now
