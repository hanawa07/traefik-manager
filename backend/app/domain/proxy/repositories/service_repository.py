from abc import ABC, abstractmethod
from uuid import UUID
from ..entities.service import Service


class ServiceRepository(ABC):

    @abstractmethod
    async def save(self, service: Service) -> None:
        pass

    @abstractmethod
    async def find_by_id(self, service_id: UUID) -> Service | None:
        pass

    @abstractmethod
    async def find_all(self) -> list[Service]:
        pass

    @abstractmethod
    async def find_by_domain(self, domain: str) -> Service | None:
        pass

    @abstractmethod
    async def delete(self, service_id: UUID) -> None:
        pass
