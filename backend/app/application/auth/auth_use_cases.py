from app.core.security import verify_password
from app.domain.proxy.entities.user import User
from app.domain.proxy.repositories.user_repository import UserRepository


class AuthUseCases:
    def __init__(self, repository: UserRepository):
        self.repository = repository

    async def authenticate_user(self, username: str, password: str) -> User | None:
        user = await self.repository.find_by_username(username.strip())
        if not user or not user.is_active:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user
