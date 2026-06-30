from collections.abc import Awaitable, Callable
from inspect import Parameter, Signature
from typing import Any

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.database import get_db
from app.interfaces.api.dependencies import get_current_user, require_admin

ReadSettings = Callable[[Any, AsyncSession], Awaitable[Any]]
UpdateSettings = Callable[[Any, Any, Request | None, AsyncSession, dict], Awaitable[Any]]


def build_read_endpoint(*, route, function_name: str, read_settings: ReadSettings):
    async def endpoint(
        db: AsyncSession = Depends(get_db),
        _: dict = Depends(get_current_user),
    ):
        return await read_settings(route, db)

    endpoint.__name__ = function_name
    endpoint.__qualname__ = function_name
    return endpoint


def build_update_endpoint(
    *,
    route,
    request_model: type,
    function_name: str,
    update_settings: UpdateSettings,
):
    async def endpoint(request, http_request=None, db=None, _=None):
        return await update_settings(route, request, http_request, db, _)

    endpoint.__name__ = function_name
    endpoint.__qualname__ = function_name
    endpoint.__signature__ = _build_update_signature(request_model)
    endpoint.__annotations__ = {
        "request": request_model,
        "http_request": Request,
        "db": AsyncSession,
        "_": dict,
    }
    return endpoint


def _build_update_signature(request_model: type) -> Signature:
    return Signature(
        parameters=[
            Parameter("request", Parameter.POSITIONAL_OR_KEYWORD, annotation=request_model),
            Parameter(
                "http_request",
                Parameter.POSITIONAL_OR_KEYWORD,
                default=None,
                annotation=Request,
            ),
            Parameter(
                "db",
                Parameter.POSITIONAL_OR_KEYWORD,
                default=Depends(get_db),
                annotation=AsyncSession,
            ),
            Parameter(
                "_",
                Parameter.POSITIONAL_OR_KEYWORD,
                default=Depends(require_admin),
                annotation=dict,
            ),
        ],
    )
