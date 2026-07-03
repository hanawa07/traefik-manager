import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse

from app.app_routes import register_api_routes, register_health_route
from app.core.config import settings
from app.core.logging_config import get_client_ip, is_logging_exempt_path

logger = logging.getLogger(__name__)
request_logger = logging.getLogger("app.request")

INTERNAL_ALLOWED_HOSTS = [
    "backend",
    "backend:8000",
    "traefik-manager-backend",
    "traefik-manager-backend:8000",
]


def create_app(lifespan) -> FastAPI:
    app = FastAPI(
        title="Traefik Manager",
        description="Traefik + Authentik 통합 관리 도구",
        version=settings.TRAEFIK_MANAGER_VERSION,
        lifespan=lifespan,
        redirect_slashes=False,
        docs_url="/api/docs" if settings.APP_ENV == "development" else None,
        redoc_url=None,
    )
    configure_security_middleware(app)
    register_request_logging(app)
    register_exception_handlers(app)
    register_api_routes(app)
    register_health_route(app)
    return app


def configure_security_middleware(app: FastAPI) -> None:
    allowed_hosts = list(dict.fromkeys([*settings.ALLOWED_HOSTS, *INTERNAL_ALLOWED_HOSTS]))
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=allowed_hosts,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
        allow_headers=["Authorization", "Content-Type", "X-CSRF-Token"],
    )


def register_request_logging(app: FastAPI) -> None:
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


def register_exception_handlers(app: FastAPI) -> None:
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
