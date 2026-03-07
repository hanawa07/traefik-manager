from uuid import UUID

from app.core.security import hash_password
from app.domain.proxy.entities.user import User
from app.domain.proxy.repositories.user_repository import UserRepository


class UserUseCases:
    def __init__(self, repository: UserRepository):
        self.repository = repository

    async def list_users(self) -> list[User]:
        return await self.repository.find_all()

    async def create_user(self, data) -> User:
        existing = await self.repository.find_by_username(data.username)
        if existing:
            raise ValueError(f"이미 존재하는 사용자 이름입니다: {data.username}")

        user = User.create(
            username=data.username,
            hashed_password=hash_password(data.password),
            role=data.role,
            is_active=data.is_active,
        )
        await self.repository.save(user)
        return user

    async def update_user(self, user_id: UUID, data) -> User | None:
        user = await self.repository.find_by_id(user_id)
        if not user:
            return None

        update_payload = data.model_dump(exclude_unset=True)
        next_username = update_payload.get("username")
        if next_username and next_username != user.username:
            existing = await self.repository.find_by_username(next_username)
            if existing and existing.id != user.id:
                raise ValueError(f"이미 존재하는 사용자 이름입니다: {next_username}")

        next_role = update_payload.get("role", user.role)
        next_is_active = update_payload.get("is_active", user.is_active)
        if user.role == "admin" and (next_role != "admin" or next_is_active is False):
            await self._ensure_other_admin_exists(user.id)

        user.update(
            username=next_username,
            hashed_password=(
                hash_password(update_payload["password"])
                if "password" in update_payload
                else None
            ),
            role=update_payload.get("role"),
            is_active=update_payload.get("is_active"),
        )
        await self.repository.save(user)
        return user

    async def delete_user(self, user_id: UUID) -> None:
        user = await self.repository.find_by_id(user_id)
        if not user:
            return

        if user.role == "admin":
            await self._ensure_other_admin_exists(user.id)
        await self.repository.delete(user_id)

    async def _ensure_other_admin_exists(self, target_user_id: UUID) -> None:
        users = await self.repository.find_all()
        other_admins = [
            user
            for user in users
            if user.id != target_user_id and user.role == "admin" and user.is_active
        ]
        if not other_admins:
            raise ValueError("활성 관리자 계정은 최소 1개 이상 유지되어야 합니다")
