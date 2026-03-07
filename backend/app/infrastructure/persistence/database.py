import asyncio
from uuid import uuid4

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text

from app.core.config import settings
from app.infrastructure.persistence.migration_runner import ensure_database_schema

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.APP_ENV == "development",
)

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def init_db():
    await asyncio.to_thread(ensure_database_schema, settings.DATABASE_URL)
    async with engine.begin() as conn:
        await _ensure_default_admin_user(conn)


async def _ensure_default_admin_user(conn) -> None:
    from app.core.security import hash_password

    result = await conn.execute(text("SELECT COUNT(*) FROM users"))
    if int(result.scalar_one()) > 0:
        return

    await conn.execute(
        text(
            """
            INSERT INTO users (
                id,
                username,
                hashed_password,
                role,
                is_active,
                created_at,
                updated_at
            ) VALUES (
                :id,
                :username,
                :hashed_password,
                'admin',
                1,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            )
            """
        ),
        {
            "id": str(uuid4()),
            "username": settings.ADMIN_USERNAME.strip(),
            "hashed_password": hash_password(settings.ADMIN_PASSWORD),
        },
    )


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
