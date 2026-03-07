from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text

from app.core.config import settings
from uuid import uuid4

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.APP_ENV == "development",
)

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _apply_sqlite_migrations(conn)
        await _ensure_default_admin_user(conn)


async def _apply_sqlite_migrations(conn) -> None:
    # 프로젝트는 기본적으로 SQLite를 사용하므로, 누락 컬럼을 안전하게 보강한다.
    if not settings.DATABASE_URL.startswith("sqlite"):
        return

    result = await conn.execute(text("PRAGMA table_info(services)"))
    existing_columns = {row[1] for row in result.fetchall()}

    migrations = {
        "https_redirect_enabled": "ALTER TABLE services ADD COLUMN https_redirect_enabled BOOLEAN NOT NULL DEFAULT 1",
        "allowed_ips": "ALTER TABLE services ADD COLUMN allowed_ips JSON NOT NULL DEFAULT '[]'",
        "rate_limit_average": "ALTER TABLE services ADD COLUMN rate_limit_average INTEGER",
        "rate_limit_burst": "ALTER TABLE services ADD COLUMN rate_limit_burst INTEGER",
        "custom_headers": "ALTER TABLE services ADD COLUMN custom_headers JSON NOT NULL DEFAULT '{}'",
        "basic_auth_users": "ALTER TABLE services ADD COLUMN basic_auth_users JSON NOT NULL DEFAULT '[]'",
        "middleware_template_ids": "ALTER TABLE services ADD COLUMN middleware_template_ids JSON NOT NULL DEFAULT '[]'",
        "authentik_group_id": "ALTER TABLE services ADD COLUMN authentik_group_id VARCHAR(100)",
        "authentik_group_name": "ALTER TABLE services ADD COLUMN authentik_group_name VARCHAR(255)",
        "authentik_policy_id": "ALTER TABLE services ADD COLUMN authentik_policy_id VARCHAR(100)",
        "authentik_policy_binding_id": "ALTER TABLE services ADD COLUMN authentik_policy_binding_id VARCHAR(100)",
        "cloudflare_record_id": "ALTER TABLE services ADD COLUMN cloudflare_record_id VARCHAR(100)",
    }

    for column_name, sql in migrations.items():
        if column_name not in existing_columns:
            await conn.execute(text(sql))

    await conn.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS middleware_templates (
                id VARCHAR(36) PRIMARY KEY,
                name VARCHAR(120) NOT NULL,
                type VARCHAR(50) NOT NULL,
                config JSON NOT NULL DEFAULT '{}',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
    )
    await conn.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(36) PRIMARY KEY,
                username VARCHAR(100) NOT NULL UNIQUE,
                hashed_password VARCHAR(255) NOT NULL,
                role VARCHAR(20) NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
    )


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
