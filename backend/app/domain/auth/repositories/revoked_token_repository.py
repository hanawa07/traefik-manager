from abc import ABC, abstractmethod

from app.domain.auth.entities.revoked_token import RevokedToken


class RevokedTokenRepository(ABC):
    @abstractmethod
    async def save(self, token: RevokedToken) -> None:
        pass

    @abstractmethod
    async def is_revoked(self, jti: str) -> bool:
        pass
