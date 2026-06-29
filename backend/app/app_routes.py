from fastapi import FastAPI

from app.interfaces.api.v1.routers import (
    audit,
    auth,
    backup,
    certificates,
    docker,
    middlewares,
    redirects,
    services,
    settings as settings_router,
    traefik,
    users,
)


def register_api_routes(app: FastAPI) -> None:
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


def register_health_route(app: FastAPI) -> None:
    @app.get("/api/health")
    async def health_check():
        return {"status": "정상"}
