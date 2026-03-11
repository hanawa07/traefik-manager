from datetime import datetime, timezone
from uuid import uuid4

import pytest

from app.core.security import hash_password
from app.domain.proxy.entities.user import User
from app.application.auth.auth_use_cases import AuthUseCases


class InMemoryUserRepository:
    def __init__(self, users: list[User]):
        self.users = {user.username: user for user in users}

    async def save(self, user: User) -> None:
        self.users[user.username] = user

    async def find_by_id(self, user_id):
        for user in self.users.values():
            if user.id == user_id:
                return user
        return None

    async def find_by_username(self, username: str):
        return self.users.get(username)

    async def find_all(self) -> list[User]:
        return list(self.users.values())

    async def delete(self, user_id) -> None:
        for username, user in list(self.users.items()):
            if user.id == user_id:
                del self.users[username]
                return

    async def count_admins(self) -> int:
        return sum(1 for user in self.users.values() if user.role == "admin")

@pytest.mark.asyncio
async def test_authenticate_user_returns_user_for_valid_credentials():
    user = User(
        id=uuid4(),
        username="admin",
        hashed_password=hash_password("secret123"),
        role="admin",
        is_active=True,
        token_version=0,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    use_cases = AuthUseCases(InMemoryUserRepository([user]))

    result = await use_cases.authenticate_user("admin", "secret123")

    assert result.authenticated_user is not None
    assert result.authenticated_user.username == "admin"
    assert result.authenticated_user.role == "admin"
    assert result.failure_reason is None

@pytest.mark.asyncio
async def test_authenticate_user_returns_none_for_wrong_password():
    user = User(
        id=uuid4(),
        username="viewer",
        hashed_password=hash_password("secret123"),
        role="viewer",
        is_active=True,
        token_version=0,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    use_cases = AuthUseCases(InMemoryUserRepository([user]))

    result = await use_cases.authenticate_user("viewer", "wrong-password")

    assert result.authenticated_user is None
    assert result.failure_reason == "invalid_credentials"
    assert use_cases.repository.users["viewer"].failed_login_attempts == 1

@pytest.mark.asyncio
async def test_authenticate_user_returns_none_for_inactive_user():
    user = User(
        id=uuid4(),
        username="viewer",
        hashed_password=hash_password("secret123"),
        role="viewer",
        is_active=False,
        token_version=0,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    use_cases = AuthUseCases(InMemoryUserRepository([user]))

    result = await use_cases.authenticate_user("viewer", "secret123")

    assert result.authenticated_user is None
    assert result.failure_reason == "invalid_credentials"


@pytest.mark.asyncio
async def test_authenticate_user_locks_user_after_threshold():
    user = User(
        id=uuid4(),
        username="locked-user",
        hashed_password=hash_password("secret123"),
        role="admin",
        is_active=True,
        token_version=0,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    use_cases = AuthUseCases(
        InMemoryUserRepository([user]),
        max_failed_attempts=3,
        failure_window_minutes=15,
        lockout_minutes=10,
    )

    await use_cases.authenticate_user("locked-user", "wrong-password")
    await use_cases.authenticate_user("locked-user", "wrong-password")
    result = await use_cases.authenticate_user("locked-user", "wrong-password")

    assert result.authenticated_user is None
    assert result.failure_reason == "locked"
    assert result.locked_until is not None
    assert use_cases.repository.users["locked-user"].failed_login_attempts == 3


@pytest.mark.asyncio
async def test_authenticate_user_resets_failures_after_success():
    now = datetime.now(timezone.utc)
    user = User(
        id=uuid4(),
        username="viewer",
        hashed_password=hash_password("secret123"),
        role="viewer",
        is_active=True,
        token_version=0,
        created_at=now,
        updated_at=now,
        failed_login_attempts=2,
        last_failed_login_at=now,
    )
    use_cases = AuthUseCases(InMemoryUserRepository([user]))

    result = await use_cases.authenticate_user("viewer", "secret123")

    assert result.authenticated_user is not None
    assert use_cases.repository.users["viewer"].failed_login_attempts == 0
    assert use_cases.repository.users["viewer"].last_failed_login_at is None
