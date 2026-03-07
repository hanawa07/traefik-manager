from abc import ABC, abstractmethod
from uuid import UUID

from app.domain.proxy.entities.middleware_template import MiddlewareTemplate


class MiddlewareTemplateRepository(ABC):

    @abstractmethod
    async def save(self, template: MiddlewareTemplate) -> None:
        pass

    @abstractmethod
    async def find_by_id(self, template_id: UUID) -> MiddlewareTemplate | None:
        pass

    @abstractmethod
    async def find_all(self) -> list[MiddlewareTemplate]:
        pass

    @abstractmethod
    async def find_many_by_ids(self, template_ids: list[UUID]) -> list[MiddlewareTemplate]:
        pass

    @abstractmethod
    async def delete(self, template_id: UUID) -> None:
        pass
