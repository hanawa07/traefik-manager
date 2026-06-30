from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.audit import audit_service
from app.application.proxy.middleware_template_use_cases import MiddlewareTemplateUseCases
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.repositories.sqlite_middleware_template_repository import (
    SQLiteMiddlewareTemplateRepository,
)
from app.infrastructure.persistence.repositories.sqlite_service_repository import (
    SQLiteServiceRepository,
)
from app.infrastructure.traefik.file_provider_writer import FileProviderWriter
from app.interfaces.api.dependencies import get_current_user, require_write_access
from app.interfaces.api.v1.routers.middlewares_read_routes import register_middleware_read_routes
from app.interfaces.api.v1.routers.middlewares_rollback_routes import (
    register_middleware_rollback_routes,
)
from app.interfaces.api.v1.routers.middlewares_write_routes import register_middleware_write_routes
from app.interfaces.api.v1.schemas.middleware_schemas import (
    MiddlewareTemplateCreate,
    MiddlewareTemplateResponse,
    MiddlewareTemplateUpdate,
)

router = APIRouter()


def get_use_cases(db: AsyncSession = Depends(get_db)) -> MiddlewareTemplateUseCases:
    return MiddlewareTemplateUseCases(
        repository=SQLiteMiddlewareTemplateRepository(db),
        service_repository=SQLiteServiceRepository(db),
        file_writer=FileProviderWriter(),
    )


_read_endpoints = register_middleware_read_routes(
    router,
    get_use_cases=get_use_cases,
    current_user_dependency=get_current_user,
)
list_templates = _read_endpoints.list_templates
get_template = _read_endpoints.get_template

_write_endpoints = register_middleware_write_routes(
    router,
    get_use_cases=get_use_cases,
    write_access_dependency=require_write_access,
    audit_service_provider=lambda: audit_service,
)
create_template = _write_endpoints.create_template
update_template = _write_endpoints.update_template
delete_template = _write_endpoints.delete_template

_rollback_endpoints = register_middleware_rollback_routes(
    router,
    get_use_cases=get_use_cases,
    write_access_dependency=require_write_access,
    audit_service_provider=lambda: audit_service,
)
rollback_template_change = _rollback_endpoints.rollback_template_change

__all__ = [
    "MiddlewareTemplateCreate",
    "MiddlewareTemplateResponse",
    "MiddlewareTemplateUpdate",
    "create_template",
    "delete_template",
    "get_template",
    "get_use_cases",
    "list_templates",
    "rollback_template_change",
    "router",
    "update_template",
]
