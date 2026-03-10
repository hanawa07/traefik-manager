import logging
import time
from fastapi import FastAPI
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from app.core.logging_config import (
    get_client_ip,
    is_logging_exempt_path,
    setup_logging,
)
from app.infrastructure.persistence.database import init_db, AsyncSessionLocal
from app.infrastructure.traefik.file_provider_writer import FileProviderWriter
from app.interfaces.api.v1.routers import (
    services,
    auth,
    certificates,
    redirects,
    middlewares,
    users,
    docker,
    backup,
    traefik,
    settings as settings_router,
    audit,
)
from app.core.config import settings

logger = logging.getLogger(__name__)
request_logger = logging.getLogger("app.request")


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    await init_db()
    await _ensure_service_route_files()
    await _ensure_authentik_middleware_file()
    yield


async def _ensure_service_route_files() -> None:
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
        logger.warning("서비스 라우트 파일 startup 재생성 실패 (무시)", exc_info=True)


async def _ensure_authentik_middleware_file() -> None:
    """startup 시 auth_mode가 authentik인 서비스가 있으면 authentik ForwardAuth 미들웨어 파일을 생성한다."""
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
        logger.warning("Authentik 미들웨어 파일 startup 생성 실패 (무시)", exc_info=True)


app = FastAPI(
    title="Traefik Manager",
    description="Traefik + Authentik 통합 관리 도구",
    version="0.1.0",
    lifespan=lifespan,
    redirect_slashes=False,
    # 프로덕션에서 docs 비활성화
    docs_url="/api/docs" if settings.APP_ENV == "development" else None,
    redoc_url=None,
)

# 보안 미들웨어
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.ALLOWED_HOSTS,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    if is_logging_exempt_path(request.url.path):
        return await call_next(request)

    started_at = time.perf_counter()
    response = await call_next(request)
    request_logger.info(
        "요청 완료",
        extra={
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": round((time.perf_counter() - started_at) * 1000, 2),
            "client_ip": get_client_ip(request),
        },
    )
    return response


@app.exception_handler(Exception)
async def handle_unexpected_exception(request: Request, exc: Exception):
    logger.exception(
        "처리되지 않은 서버 오류",
        extra={
            "method": request.method,
            "path": request.url.path,
            "client_ip": get_client_ip(request),
        },
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "서버 내부 오류가 발생했습니다"},
    )


# 라우터 등록
app.include_router(auth.router, prefix="/api/v1/auth", tags=["인증"])
app.include_router(users.router, prefix="/api/v1/users", tags=["사용자"])
app.include_router(audit.router, prefix="/api/v1/audit", tags=["감사 로그"])
app.include_router(services.router, prefix="/api/v1/services", tags=["서비스"])
app.include_router(middlewares.router, prefix="/api/v1/middlewares", tags=["미들웨어"])
app.include_router(redirects.router, prefix="/api/v1/redirects", tags=["리다이렉트"])
app.include_router(docker.router, prefix="/api/v1/docker", tags=["Docker"])
app.include_router(backup.router, prefix="/api/v1/backup", tags=["백업"])
app.include_router(traefik.router, prefix="/api/v1/traefik", tags=["Traefik"])
app.include_router(settings_router.router, prefix="/api/v1/settings", tags=["설정"])
app.include_router(certificates.router, prefix="/api/v1/certificates", tags=["인증서"])


@app.get("/api/health")
async def health_check():
    return {"status": "정상"}
