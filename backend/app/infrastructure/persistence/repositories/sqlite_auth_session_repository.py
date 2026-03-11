from datetime import datetime

from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.auth.entities.auth_session import AuthSession
from app.domain.auth.repositories.auth_session_repository import AuthSessionRepository
from app.infrastructure.persistence.models import AuthSessionModel


class SQLiteAuthSessionRepository(AuthSessionRepository):
    def __init__(self, db: AsyncSession):
        self.db = db

    async def save(self, session: AuthSession) -> None:
        existing = await self.db.get(AuthSessionModel, session.id)
        if existing:
            existing.username = session.username
            existing.role = session.role
            existing.token_version = session.token_version
            existing.session_secret_hash = session.session_secret_hash
            existing.last_seen_at = session.last_seen_at
            existing.expires_at = session.expires_at
            existing.idle_expires_at = session.idle_expires_at
            existing.revoked_at = session.revoked_at
            existing.revoked_reason = session.revoked_reason
            existing.ip_address = session.ip_address
            existing.user_agent = session.user_agent
        else:
            self.db.add(
                AuthSessionModel(
                    id=session.id,
                    user_id=session.user_id,
                    username=session.username,
                    role=session.role,
                    token_version=session.token_version,
                    session_secret_hash=session.session_secret_hash,
                    issued_at=session.issued_at,
                    last_seen_at=session.last_seen_at,
                    expires_at=session.expires_at,
                    idle_expires_at=session.idle_expires_at,
                    revoked_at=session.revoked_at,
                    revoked_reason=session.revoked_reason,
                    ip_address=session.ip_address,
                    user_agent=session.user_agent,
                )
            )

    async def find_by_id(self, session_id: str) -> AuthSession | None:
        model = await self.db.get(AuthSessionModel, session_id)
        return self._to_entity(model) if model else None

    async def find_active_by_user_id(self, user_id: str, now: datetime) -> list[AuthSession]:
        result = await self.db.execute(
            select(AuthSessionModel)
            .where(AuthSessionModel.user_id == user_id)
            .where(AuthSessionModel.revoked_at.is_(None))
            .where(AuthSessionModel.expires_at > now)
            .where(AuthSessionModel.idle_expires_at > now)
            .order_by(AuthSessionModel.last_seen_at.desc(), AuthSessionModel.issued_at.desc())
        )
        return [self._to_entity(model) for model in result.scalars().all()]

    async def delete_inactive(self, now: datetime) -> int:
        result = await self.db.execute(
            delete(AuthSessionModel).where(
                or_(
                    AuthSessionModel.expires_at < now,
                    AuthSessionModel.idle_expires_at < now,
                    AuthSessionModel.revoked_at.is_not(None),
                )
            )
        )
        return int(result.rowcount or 0)

    def _to_entity(self, model: AuthSessionModel) -> AuthSession:
        return AuthSession(
            id=model.id,
            user_id=model.user_id,
            username=model.username,
            role=model.role,
            token_version=model.token_version,
            session_secret_hash=model.session_secret_hash,
            issued_at=model.issued_at,
            last_seen_at=model.last_seen_at,
            expires_at=model.expires_at,
            idle_expires_at=model.idle_expires_at,
            revoked_at=model.revoked_at,
            revoked_reason=model.revoked_reason,
            ip_address=model.ip_address,
            user_agent=model.user_agent,
        )
