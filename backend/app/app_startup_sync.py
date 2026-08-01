import logging

from app.infrastructure.persistence.database import AsyncSessionLocal
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import (
    SQLiteSystemSettingsRepository,
)
from app.infrastructure.traefik.file_provider_writer import FileProviderWriter

logger = logging.getLogger(__name__)


async def ensure_service_route_files() -> None:
    from app.infrastructure.persistence.repositories.sqlite_middleware_template_repository import (
        SQLiteMiddlewareTemplateRepository,
    )
    from app.infrastructure.persistence.repositories.sqlite_service_repository import (
        SQLiteServiceRepository,
    )
    from app.infrastructure.traefik.startup_sync import sync_existing_service_configs

    try:
        async with AsyncSessionLocal() as session:
            rewritten = await sync_existing_service_configs(
                service_repository=SQLiteServiceRepository(session),
                middleware_template_repository=SQLiteMiddlewareTemplateRepository(session),
                file_writer=FileProviderWriter(),
            )
            if rewritten > 0:
                logger.info("서비스 라우트 파일 재생성 완료 (서비스 %d개)", rewritten)
    except Exception:
        logger.warning("서비스 라우트 파일 startup 재생성 실패 (재시도 예정)", exc_info=True)
        raise


async def ensure_authentik_middleware_file() -> None:
    """Create ForwardAuth config when at least one service uses Authentik."""
    from sqlalchemy import text

    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                text("SELECT COUNT(*) FROM services WHERE auth_mode = 'authentik'")
            )
            count = int(result.scalar_one())
            if count > 0:
                FileProviderWriter().write_authentik_middleware()
                logger.info("Authentik 미들웨어 파일 생성 완료 (활성화된 서비스 %d개)", count)
    except Exception:
        logger.warning("Authentik 미들웨어 파일 startup 생성 실패 (재시도 예정)", exc_info=True)
        raise


async def ensure_traefik_dashboard_public_route() -> None:
    from app.infrastructure.traefik.startup_sync import sync_traefik_dashboard_public_config

    try:
        async with AsyncSessionLocal() as session:
            enabled = await sync_traefik_dashboard_public_config(
                settings_repository=SQLiteSystemSettingsRepository(session),
                file_writer=FileProviderWriter(),
            )
            if enabled:
                logger.info("Traefik 디버그 대시보드 public 라우트 동기화 완료")
    except Exception:
        logger.warning("Traefik 디버그 대시보드 startup 동기화 실패 (재시도 예정)", exc_info=True)
        raise
