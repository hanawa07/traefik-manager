from abc import ABC, abstractmethod
from uuid import UUID

from app.domain.proxy.entities.user import User


class UserRepository(ABC):
    @abstractmethod
    async def save(self, user: User) -> None:
        pass

    @abstractmethod
    async def find_by_id(self, user_id: UUID) -> User | None:
        pass

    @abstractmethod
    async def find_by_username(self, username: str) -> User | None:
        pass

    @abstractmethod
    async def find_all(self) -> list[User]:
        pass

    @abstractmethod
    async def delete(self, user_id: UUID) -> None:
        pass

    @abstractmethod
    async def count_admins(self) -> int:
        pass
