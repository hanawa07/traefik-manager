import unittest
from datetime import datetime
from uuid import uuid4

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


class AuthUseCasesTest(unittest.IsolatedAsyncioTestCase):
    async def test_authenticate_user_returns_user_for_valid_credentials(self):
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

        self.assertIsNotNone(authenticated)
        self.assertEqual(authenticated.username, "admin")
        self.assertEqual(authenticated.role, "admin")

    async def test_authenticate_user_returns_none_for_wrong_password(self):
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

        self.assertIsNone(authenticated)

    async def test_authenticate_user_returns_none_for_inactive_user(self):
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

        self.assertIsNone(authenticated)
