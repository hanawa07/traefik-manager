from abc import ABC, abstractmethod
from uuid import UUID

from ..entities.redirect_host import RedirectHost


class RedirectHostRepository(ABC):

    @abstractmethod
    async def save(self, redirect_host: RedirectHost) -> None:
        pass

    @abstractmethod
    async def find_by_id(self, redirect_id: UUID) -> RedirectHost | None:
        pass

    @abstractmethod
    async def find_all(self) -> list[RedirectHost]:
        pass

    @abstractmethod
    async def find_by_domain(self, domain: str) -> RedirectHost | None:
        pass

    @abstractmethod
    async def delete(self, redirect_id: UUID) -> None:
        pass
