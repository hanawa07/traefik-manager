from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
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
from app.interfaces.api.v1.routers.redirects_audit_helpers import (
    REDIRECT_CREATE_EVENT,
    REDIRECT_DELETE_EVENT,
    REDIRECT_UPDATE_EVENT,
    build_redirect_rollback_payload,
    changed_redirect_keys,
    redirect_audit_summary,
)
from app.interfaces.api.v1.routers.redirects_rollback_action import rollback_redirect_change_action
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


@router.get("", response_model=list[RedirectHostResponse], summary="리다이렉트 목록")
async def list_redirect_hosts(
    use_cases: RedirectHostUseCases = Depends(get_use_cases),
    _: dict = Depends(get_current_user),
):
    return await use_cases.list_redirect_hosts()


@router.post("", response_model=RedirectHostResponse, status_code=status.HTTP_201_CREATED, summary="리다이렉트 추가")
async def create_redirect_host(
    data: RedirectHostCreate,
    use_cases: RedirectHostUseCases = Depends(get_use_cases),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_write_access),
):
    try:
        redirect_host = await use_cases.create_redirect_host(data)
        await audit_service.record(
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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/{redirect_id}", response_model=RedirectHostResponse, summary="리다이렉트 조회")
async def get_redirect_host(
    redirect_id: UUID,
    use_cases: RedirectHostUseCases = Depends(get_use_cases),
    _: dict = Depends(get_current_user),
):
    redirect_host = await use_cases.get_redirect_host(redirect_id)
    if not redirect_host:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="리다이렉트를 찾을 수 없습니다")
    return redirect_host


@router.patch("/{redirect_id}", response_model=RedirectHostResponse, summary="리다이렉트 수정")
async def update_redirect_host(
    redirect_id: UUID,
    data: RedirectHostUpdate,
    use_cases: RedirectHostUseCases = Depends(get_use_cases),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_write_access),
):
    try:
        before_redirect = await use_cases.get_redirect_host(redirect_id)
        redirect_host = await use_cases.update_redirect_host(redirect_id, data)
        if redirect_host and before_redirect:
            before_summary = redirect_audit_summary(before_redirect)
            after_summary = redirect_audit_summary(redirect_host)
            changed_keys = changed_redirect_keys(before_summary, after_summary)
            await audit_service.record(
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
                    "rollback_payload": build_redirect_rollback_payload(before_summary, changed_keys),
                },
            )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if not redirect_host:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="리다이렉트를 찾을  수 없습니다")
    return redirect_host


@router.post(
    "/rollback/{audit_log_id}",
    response_model=RedirectHostResponse,
    summary="리다이렉트 변경 롤백",
)
async def rollback_redirect_change(
    audit_log_id: str,
    use_cases: RedirectHostUseCases = Depends(get_use_cases),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_write_access),
):
    return await rollback_redirect_change_action(
        audit_log_id=audit_log_id,
        use_cases=use_cases,
        db=db,
        current_user=current_user,
        audit_service=audit_service,
    )


@router.delete("/{redirect_id}", status_code=status.HTTP_204_NO_CONTENT, summary="리다이렉트  삭제")
async def delete_redirect_host(
    redirect_id: UUID,
    use_cases: RedirectHostUseCases = Depends(get_use_cases),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_write_access),
):
    redirect_host = await use_cases.get_redirect_host(redirect_id)
    if not redirect_host:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="리다이렉트를 찾을 수 없습니다")

    await use_cases.delete_redirect_host(redirect_id)
    await audit_service.record(
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
