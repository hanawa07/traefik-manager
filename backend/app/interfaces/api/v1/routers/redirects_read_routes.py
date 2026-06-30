from dataclasses import dataclass
from typing import Any, Callable
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.application.proxy.redirect_host_use_cases import RedirectHostUseCases
from app.interfaces.api.v1.schemas.redirect_schemas import RedirectHostResponse


@dataclass(frozen=True)
class RedirectReadEndpoints:
    list_redirect_hosts: Callable[..., Any]
    get_redirect_host: Callable[..., Any]


def register_redirect_read_routes(
    router: APIRouter,
    *,
    get_use_cases: Callable[..., RedirectHostUseCases],
    current_user_dependency: Callable[..., Any],
) -> RedirectReadEndpoints:
    @router.get(
        "",
        response_model=list[RedirectHostResponse],
        summary="리다이렉트 목록",
    )
    async def list_redirect_hosts(
        use_cases: RedirectHostUseCases = Depends(get_use_cases),
        _: dict = Depends(current_user_dependency),
    ):
        return await use_cases.list_redirect_hosts()

    @router.get(
        "/{redirect_id}",
        response_model=RedirectHostResponse,
        summary="리다이렉트 조회",
    )
    async def get_redirect_host(
        redirect_id: UUID,
        use_cases: RedirectHostUseCases = Depends(get_use_cases),
        _: dict = Depends(current_user_dependency),
    ):
        redirect_host = await use_cases.get_redirect_host(redirect_id)
        if not redirect_host:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="리다이렉트를 찾을 수 없습니다",
            )
        return redirect_host

    return RedirectReadEndpoints(
        list_redirect_hosts=list_redirect_hosts,
        get_redirect_host=get_redirect_host,
    )
