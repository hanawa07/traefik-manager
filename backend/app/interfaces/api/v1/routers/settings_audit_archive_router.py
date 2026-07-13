import asyncio

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.audit import audit_service
from app.core.config import settings
from app.core.logging_config import get_client_ip
from app.infrastructure.persistence.audit_archives import (
    AuditArchiveValidationError,
    list_audit_archives,
    resolve_audit_archive_path,
    restore_audit_archive,
)
from app.infrastructure.persistence.database import get_db
from app.interfaces.api.dependencies import require_admin
from app.interfaces.api.v1.schemas.settings_audit_retention_schemas import (
    AuditArchiveListResponse,
    AuditArchiveRestoreResponse,
)

router = APIRouter()


@router.get(
    "/audit-retention/archives",
    response_model=AuditArchiveListResponse,
    summary="감사 로그 아카이브 목록",
)
async def get_audit_archives(_: dict = Depends(require_admin)):
    archives = await asyncio.to_thread(list_audit_archives, settings.AUDIT_ARCHIVE_DIR)
    return {"archives": archives}


@router.get(
    "/audit-retention/archives/{filename}/download",
    response_class=FileResponse,
    summary="감사 로그 아카이브 다운로드",
)
async def download_audit_archive(filename: str, _: dict = Depends(require_admin)):
    try:
        path = resolve_audit_archive_path(settings.AUDIT_ARCHIVE_DIR, filename)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="감사 로그 아카이브를 찾을 수 없습니다",
        ) from exc
    return FileResponse(
        path,
        filename=path.name,
        media_type="application/gzip",
    )


@router.post(
    "/audit-retention/archives/{filename}/restore",
    response_model=AuditArchiveRestoreResponse,
    summary="감사 로그 아카이브 복원",
)
async def restore_audit_archive_file(
    filename: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: dict = Depends(require_admin),
):
    try:
        result = await restore_audit_archive(
            db,
            archive_dir=settings.AUDIT_ARCHIVE_DIR,
            filename=filename,
        )
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="감사 로그 아카이브를 찾을 수 없습니다",
        ) from exc
    except AuditArchiveValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    await audit_service.record(
        db=db,
        actor=actor["username"],
        action="restore",
        resource_type="settings",
        resource_id="audit-retention",
        resource_name="감사 로그 아카이브",
        detail={
            "event": "audit_archive_restore",
            **result,
            "client_ip": get_client_ip(request),
        },
    )
    await db.commit()
    return result
