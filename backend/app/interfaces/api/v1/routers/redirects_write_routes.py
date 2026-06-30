from dataclasses import dataclass
from typing import Any, Callable
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.proxy.redirect_host_use_cases import RedirectHostUseCases
from app.infrastructure.persistence.database import get_db
from app.interfaces.api.v1.routers.redirects_audit_helpers import (
    REDIRECT_CREATE_EVENT,
    REDIRECT_DELETE_EVENT,
    REDIRECT_UPDATE_EVENT,
    build_redirect_rollback_payload,
    changed_redirect_keys,
    redirect_audit_summary,
)
from app.interfaces.api.v1.schemas.redirect_schemas import (
    RedirectHostCreate,
    RedirectHostResponse,
    RedirectHostUpdate,
)


@dataclass(frozen=True)
class RedirectWriteEndpoints:
    create_redirect_host: Callable[..., Any]
    update_redirect_host: Callable[..., Any]
    delete_redirect_host: Callable[..., Any]


def register_redirect_write_routes(
    router: APIRouter,
    *,
    get_use_cases: Callable[..., RedirectHostUseCases],
    write_access_dependency: Callable[..., Any],
    audit_service_provider: Callable[[], Any],
) -> RedirectWriteEndpoints:
    @router.post(
        "",
        response_model=RedirectHostResponse,
        status_code=status.HTTP_201_CREATED,
        summary="리다이렉트 추가",
    )
    async def create_redirect_host(
        data: RedirectHostCreate,
        use_cases: RedirectHostUseCases = Depends(get_use_cases),
        db: AsyncSession = Depends(get_db),
        current_user: dict = Depends(write_access_dependency),
    ):
        try:
            redirect_host = await use_cases.create_redirect_host(data)
            await audit_service_provider().record(
                db=db,
                actor=current_user["username"],
                action="create",
                resource_type="redirect",
                resource_id=str(redirect_host.id),
                resource_name=redirect_host.domain,
                detail={
                    "event": REDIRECT_CREATE_EVENT,
                    "target_url": redirect_host.target_url,
                },
            )
            return redirect_host
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

    @router.patch(
        "/{redirect_id}",
        response_model=RedirectHostResponse,
        summary="리다이렉트 수정",
    )
    async def update_redirect_host(
        redirect_id: UUID,
        data: RedirectHostUpdate,
        use_cases: RedirectHostUseCases = Depends(get_use_cases),
        db: AsyncSession = Depends(get_db),
        current_user: dict = Depends(write_access_dependency),
    ):
        try:
            before_redirect = await use_cases.get_redirect_host(redirect_id)
            redirect_host = await use_cases.update_redirect_host(redirect_id, data)
            if redirect_host and before_redirect:
                before_summary = redirect_audit_summary(before_redirect)
                after_summary = redirect_audit_summary(redirect_host)
                changed_keys = changed_redirect_keys(before_summary, after_summary)
                await audit_service_provider().record(
                    db=db,
                    actor=current_user["username"],
                    action="update",
                    resource_type="redirect",
                    resource_id=str(redirect_host.id),
                    resource_name=redirect_host.domain,
                    detail={
                        "event": REDIRECT_UPDATE_EVENT,
                        "changed_keys": changed_keys,
                        "before": before_summary,
                        "after": after_summary,
                        "summary": after_summary,
                        "rollback_supported": True,
                        "rollback_payload": build_redirect_rollback_payload(
                            before_summary,
                            changed_keys,
                        ),
                    },
                )
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

        if not redirect_host:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="리다이렉트를 찾을  수 없습니다",
            )
        return redirect_host

    @router.delete(
        "/{redirect_id}",
        status_code=status.HTTP_204_NO_CONTENT,
        summary="리다이렉트  삭제",
    )
    async def delete_redirect_host(
        redirect_id: UUID,
        use_cases: RedirectHostUseCases = Depends(get_use_cases),
        db: AsyncSession = Depends(get_db),
        current_user: dict = Depends(write_access_dependency),
    ):
        redirect_host = await use_cases.get_redirect_host(redirect_id)
        if not redirect_host:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="리다이렉트를 찾을 수 없습니다",
            )

        await use_cases.delete_redirect_host(redirect_id)
        await audit_service_provider().record(
            db=db,
            actor=current_user["username"],
            action="delete",
            resource_type="redirect",
            resource_id=str(redirect_id),
            resource_name=redirect_host.domain,
            detail={
                "event": REDIRECT_DELETE_EVENT,
                "target_url": redirect_host.target_url,
            },
        )

    return RedirectWriteEndpoints(
        create_redirect_host=create_redirect_host,
        update_redirect_host=update_redirect_host,
        delete_redirect_host=delete_redirect_host,
    )
