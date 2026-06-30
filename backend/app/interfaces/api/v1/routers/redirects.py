from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.audit import audit_service
from app.application.proxy.redirect_host_use_cases import RedirectHostUseCases
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.repositories.sqlite_redirect_host_repository import (
    SQLiteRedirectHostRepository,
)
from app.infrastructure.persistence.repositories.sqlite_service_repository import (
    SQLiteServiceRepository,
)
from app.infrastructure.traefik.file_provider_writer import FileProviderWriter
from app.interfaces.api.dependencies import get_current_user, require_write_access
from app.interfaces.api.v1.routers.redirects_read_routes import register_redirect_read_routes
from app.interfaces.api.v1.routers.redirects_rollback_routes import (
    register_redirect_rollback_routes,
)
from app.interfaces.api.v1.routers.redirects_write_routes import register_redirect_write_routes
from app.interfaces.api.v1.schemas.redirect_schemas import (
    RedirectHostCreate,
    RedirectHostResponse,
    RedirectHostUpdate,
)

router = APIRouter()


def get_use_cases(db: AsyncSession = Depends(get_db)) -> RedirectHostUseCases:
    return RedirectHostUseCases(
        repository=SQLiteRedirectHostRepository(db),
        service_repository=SQLiteServiceRepository(db),
        file_writer=FileProviderWriter(),
    )


_read_endpoints = register_redirect_read_routes(
    router,
    get_use_cases=get_use_cases,
    current_user_dependency=get_current_user,
)
list_redirect_hosts = _read_endpoints.list_redirect_hosts
get_redirect_host = _read_endpoints.get_redirect_host

_write_endpoints = register_redirect_write_routes(
    router,
    get_use_cases=get_use_cases,
    write_access_dependency=require_write_access,
    audit_service_provider=lambda: audit_service,
)
create_redirect_host = _write_endpoints.create_redirect_host
update_redirect_host = _write_endpoints.update_redirect_host
delete_redirect_host = _write_endpoints.delete_redirect_host

_rollback_endpoints = register_redirect_rollback_routes(
    router,
    get_use_cases=get_use_cases,
    write_access_dependency=require_write_access,
    audit_service_provider=lambda: audit_service,
)
rollback_redirect_change = _rollback_endpoints.rollback_redirect_change

__all__ = [
    "RedirectHostCreate",
    "RedirectHostResponse",
    "RedirectHostUpdate",
    "create_redirect_host",
    "delete_redirect_host",
    "get_redirect_host",
    "get_use_cases",
    "list_redirect_hosts",
    "rollback_redirect_change",
    "router",
    "update_redirect_host",
]
