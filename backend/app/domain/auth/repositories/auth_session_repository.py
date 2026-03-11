from abc import ABC, abstractmethod
from datetime import datetime

from app.domain.auth.entities.auth_session import AuthSession


class AuthSessionRepository(ABC):
    @abstractmethod
    async def save(self, session: AuthSession) -> None:
        pass

    @abstractmethod
    async def find_by_id(self, session_id: str) -> AuthSession | None:
        pass

    @abstractmethod
    async def find_active_by_user_id(self, user_id: str, now: datetime) -> list[AuthSession]:
        pass

    @abstractmethod
    async def delete_inactive(self, now: datetime) -> int:
        pass
