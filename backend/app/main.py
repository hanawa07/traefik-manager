from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from contextlib import asynccontextmanager

from app.infrastructure.persistence.database import init_db
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
)
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="Traefik Manager",
    description="Traefik + Authentik 통합 관리 도구",
    version="0.1.0",
    lifespan=lifespan,
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

# 라우터 등록
app.include_router(auth.router, prefix="/api/v1/auth", tags=["인증"])
app.include_router(users.router, prefix="/api/v1/users", tags=["사용자"])
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
