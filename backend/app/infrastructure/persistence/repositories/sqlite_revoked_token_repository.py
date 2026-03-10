from app.domain.auth.entities.revoked_token import RevokedToken
from app.domain.auth.repositories.revoked_token_repository import RevokedTokenRepository
from app.infrastructure.persistence.models import RevokedTokenModel


class SQLiteRevokedTokenRepository(RevokedTokenRepository):
    def __init__(self, db):
        self.db = db

    async def save(self, token: RevokedToken) -> None:
        existing = await self.db.get(RevokedTokenModel, token.jti)
        if existing:
            existing.username = token.username
            existing.expires_at = token.expires_at
            existing.revoked_at = token.revoked_at
        else:
            self.db.add(
                RevokedTokenModel(
                    jti=token.jti,
                    username=token.username,
                    expires_at=token.expires_at,
                    revoked_at=token.revoked_at,
                )
            )

    async def is_revoked(self, jti: str) -> bool:
        model = await self.db.get(RevokedTokenModel, jti)
        return model is not None
