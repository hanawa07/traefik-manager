from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.proxy.entities.user import User
from app.domain.proxy.repositories.user_repository import UserRepository
from app.infrastructure.persistence.models import UserModel


class SQLiteUserRepository(UserRepository):
    def __init__(self, db: AsyncSession):
        self.db = db

    async def save(self, user: User) -> None:
        existing = await self.db.get(UserModel, str(user.id))
        if existing:
            existing.username = user.username
            existing.hashed_password = user.hashed_password
            existing.role = user.role
            existing.is_active = user.is_active
            existing.token_version = user.token_version
            existing.failed_login_attempts = user.failed_login_attempts
            existing.last_failed_login_at = user.last_failed_login_at
            existing.locked_until = user.locked_until
        else:
            self.db.add(
                UserModel(
                    id=str(user.id),
                    username=user.username,
                    hashed_password=user.hashed_password,
                    role=user.role,
                    is_active=user.is_active,
                    token_version=user.token_version,
                    failed_login_attempts=user.failed_login_attempts,
                    last_failed_login_at=user.last_failed_login_at,
                    locked_until=user.locked_until,
                )
            )

    async def find_by_id(self, user_id: UUID) -> User | None:
        model = await self.db.get(UserModel, str(user_id))
        return self._to_entity(model) if model else None

    async def find_by_username(self, username: str) -> User | None:
        result = await self.db.execute(
            select(UserModel).where(UserModel.username == username.strip())
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def find_all(self) -> list[User]:
        result = await self.db.execute(select(UserModel).order_by(UserModel.username.asc()))
        return [self._to_entity(model) for model in result.scalars().all()]

    async def delete(self, user_id: UUID) -> None:
        model = await self.db.get(UserModel, str(user_id))
        if model:
            await self.db.delete(model)

    async def count_admins(self) -> int:
        result = await self.db.execute(
            select(func.count()).select_from(UserModel).where(
                UserModel.role == "admin",
                UserModel.is_active.is_(True),
            )
        )
        return int(result.scalar_one())

    def _to_entity(self, model: UserModel) -> User:
        return User(
            id=UUID(model.id),
            username=model.username,
            hashed_password=model.hashed_password,
            role=model.role,
            is_active=model.is_active,
            token_version=model.token_version,
            created_at=model.created_at,
            updated_at=model.updated_at,
            failed_login_attempts=model.failed_login_attempts,
            last_failed_login_at=model.last_failed_login_at,
            locked_until=model.locked_until,
        )
