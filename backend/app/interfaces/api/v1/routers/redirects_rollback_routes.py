from dataclasses import dataclass
from typing import Any, Callable

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.proxy.redirect_host_use_cases import RedirectHostUseCases
from app.infrastructure.persistence.database import get_db
from app.interfaces.api.v1.routers.redirects_rollback_action import (
    rollback_redirect_change_action,
)
from app.interfaces.api.v1.schemas.redirect_schemas import RedirectHostResponse


@dataclass(frozen=True)
class RedirectRollbackEndpoints:
    rollback_redirect_change: Callable[..., Any]


def register_redirect_rollback_routes(
    router: APIRouter,
    *,
    get_use_cases: Callable[..., RedirectHostUseCases],
    write_access_dependency: Callable[..., Any],
    audit_service_provider: Callable[[], Any],
) -> RedirectRollbackEndpoints:
    @router.post(
        "/rollback/{audit_log_id}",
        response_model=RedirectHostResponse,
        summary="리다이렉트 변경 롤백",
    )
    async def rollback_redirect_change(
        audit_log_id: str,
        use_cases: RedirectHostUseCases = Depends(get_use_cases),
        db: AsyncSession = Depends(get_db),
        current_user: dict = Depends(write_access_dependency),
    ):
        return await rollback_redirect_change_action(
            audit_log_id=audit_log_id,
            use_cases=use_cases,
            db=db,
            current_user=current_user,
            audit_service=audit_service_provider(),
        )

    return RedirectRollbackEndpoints(rollback_redirect_change=rollback_redirect_change)
