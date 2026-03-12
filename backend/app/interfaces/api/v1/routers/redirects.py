from copy import deepcopy
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.proxy.redirect_host_use_cases import RedirectHostUseCases
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.models import AuditLogModel
from app.infrastructure.persistence.repositories.sqlite_redirect_host_repository import (
    SQLiteRedirectHostRepository,
)
from app.infrastructure.persistence.repositories.sqlite_service_repository import (
    SQLiteServiceRepository,
)
from app.infrastructure.traefik.file_provider_writer import FileProviderWriter
from app.interfaces.api.dependencies import get_current_user, require_write_access
from app.application.audit import audit_service
from app.interfaces.api.v1.schemas.redirect_schemas import (
    RedirectHostCreate,
    RedirectHostResponse,
    RedirectHostUpdate,
)

router = APIRouter()
REDIRECT_UPDATE_EVENT = "redirect_update"
REDIRECT_ROLLBACK_EVENT = "redirect_rollback"


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
            detail={"target_url": redirect_host.target_url},
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
            before_summary = _redirect_audit_summary(before_redirect)
            after_summary = _redirect_audit_summary(redirect_host)
            changed_keys = sorted(
                [
                    key
                    for key in set(before_summary.keys()) | set(after_summary.keys())
                    if before_summary.get(key) != after_summary.get(key)
                ]
            )
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
                    "rollback_payload": _build_redirect_rollback_payload(before_summary, changed_keys),
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
    result = await db.execute(select(AuditLogModel).where(AuditLogModel.id == audit_log_id))
    audit_log = result.scalar_one_or_none()
    if audit_log is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="대상 리다이렉트 변경 로그를 찾을 수 없습니다")
    if audit_log.resource_type != "redirect" or audit_log.action != "update":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="리다이렉트 변경 로그만 롤백할 수 있습니다")

    detail = audit_log.detail or {}
    rollback_payload = detail.get("rollback_payload")
    if (
        detail.get("event") != REDIRECT_UPDATE_EVENT
        or detail.get("rollback_supported") is not True
        or not isinstance(rollback_payload, dict)
    ):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="이 리다이렉트 변경은 안전 롤백을 지원하지 않습니다")

    current_redirect = await use_cases.get_redirect_host(UUID(audit_log.resource_id))
    if current_redirect is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="리다이렉트를 찾을 수 없습니다")

    before_summary = _redirect_audit_summary(current_redirect)
    updated_redirect = await use_cases.update_redirect_host(
        UUID(audit_log.resource_id),
        RedirectHostUpdate(**rollback_payload),
    )
    if updated_redirect is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="리다이렉트를 찾을 수 없습니다")

    after_summary = _redirect_audit_summary(updated_redirect)
    changed_keys = sorted(
        [
            key
            for key in set(before_summary.keys()) | set(after_summary.keys())
            if before_summary.get(key) != after_summary.get(key)
        ]
    )
    await audit_service.record(
        db=db,
        actor=current_user["username"],
        action="rollback",
        resource_type="redirect",
        resource_id=str(updated_redirect.id),
        resource_name=str(updated_redirect.domain),
        detail={
            "event": REDIRECT_ROLLBACK_EVENT,
            "source_audit_id": audit_log_id,
            "changed_keys": changed_keys,
            "before": before_summary,
            "after": after_summary,
            "summary": after_summary,
        },
    )
    return updated_redirect



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
    )


def _redirect_audit_summary(redirect_host) -> dict[str, object]:
    return {
        "domain": str(getattr(redirect_host, "domain", "")),
        "target_url": getattr(redirect_host, "target_url", ""),
        "permanent": bool(getattr(redirect_host, "permanent", True)),
        "tls_enabled": bool(getattr(redirect_host, "tls_enabled", True)),
    }


def _build_redirect_rollback_payload(
    before_summary: dict[str, object],
    changed_keys: list[str],
) -> dict[str, object]:
    return {key: deepcopy(before_summary[key]) for key in changed_keys if key in before_summary}
