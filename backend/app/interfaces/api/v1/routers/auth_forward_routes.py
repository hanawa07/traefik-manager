from dataclasses import dataclass
from typing import Any, Callable

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.database import get_db
from app.interfaces.api.v1.routers.auth_forward import verify_token_handler


@dataclass(frozen=True)
class AuthForwardEndpoints:
    verify_token: Callable[..., Any]


def register_auth_forward_routes(
    router: APIRouter,
    *,
    service_model_provider: Callable[[], type[Any]],
    resolve_authenticated_user_provider: Callable[[], Callable[..., Any]],
) -> AuthForwardEndpoints:
    @router.get(
        "/verify",
        status_code=200,
        summary="Traefik forwardAuth 토큰 검증",
        include_in_schema=False,
    )
    async def verify_token(
        request: Request,
        db: AsyncSession = Depends(get_db),
    ):
        return await verify_token_handler(
            request=request,
            db=db,
            service_model=service_model_provider(),
            resolve_authenticated_user_func=resolve_authenticated_user_provider(),
        )

    return AuthForwardEndpoints(verify_token=verify_token)
