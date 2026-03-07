from datetime import datetime
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
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    use_cases = AuthUseCases(InMemoryUserRepository([user]))

    authenticated = await use_cases.authenticate_user("admin", "secret123")

    assert authenticated is not None
    assert authenticated.username == "admin"
    assert authenticated.role == "admin"

@pytest.mark.asyncio
async def test_authenticate_user_returns_none_for_wrong_password():
    user = User(
        id=uuid4(),
        username="viewer",
        hashed_password=hash_password("secret123"),
        role="viewer",
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    use_cases = AuthUseCases(InMemoryUserRepository([user]))

    authenticated = await use_cases.authenticate_user("viewer", "wrong-password")

    assert authenticated is None

@pytest.mark.asyncio
async def test_authenticate_user_returns_none_for_inactive_user():
    user = User(
        id=uuid4(),
        username="viewer",
        hashed_password=hash_password("secret123"),
        role="viewer",
        is_active=False,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    use_cases = AuthUseCases(InMemoryUserRepository([user]))

    authenticated = await use_cases.authenticate_user("viewer", "secret123")

    assert authenticated is None