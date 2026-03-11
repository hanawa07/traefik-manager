from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.backup.backup_use_cases import BackupUseCases
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.repositories.sqlite_middleware_template_repository import (
    SQLiteMiddlewareTemplateRepository,
)
from app.infrastructure.persistence.repositories.sqlite_redirect_host_repository import (
    SQLiteRedirectHostRepository,
)
from app.infrastructure.persistence.repositories.sqlite_service_repository import (
    SQLiteServiceRepository,
)
from app.infrastructure.traefik.file_provider_writer import FileProviderWriter
from app.interfaces.api.dependencies import get_current_user, require_admin, require_write_access
from app.interfaces.api.v1.schemas.backup_schemas import (
    BackupExportResponse,
    BackupImportRequest,
    BackupImportResultResponse,
    BackupValidateResponse,
)

router = APIRouter()


def get_use_cases(db: AsyncSession = Depends(get_db)) -> BackupUseCases:
    return BackupUseCases(
        service_repository=SQLiteServiceRepository(db),
        middleware_template_repository=SQLiteMiddlewareTemplateRepository(db),
        redirect_repository=SQLiteRedirectHostRepository(db),
        file_writer=FileProviderWriter(),
    )


@router.get("/export", response_model=BackupExportResponse, summary="설정 백업 내보내기")
async def export_backup(
    use_cases: BackupUseCases = Depends(get_use_cases),
    _: dict = Depends(require_admin),
):
    return await use_cases.export_all()


@router.post("/import", response_model=BackupImportResultResponse, summary="설정 백업 가져오기")
async def import_backup(
    request: BackupImportRequest,
    use_cases: BackupUseCases = Depends(get_use_cases),
    _: dict = Depends(require_write_access),
):
    try:
        return await use_cases.import_all(mode=request.mode, payload=request.data.model_dump())
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.post("/validate", response_model=BackupValidateResponse, summary="설정 백업 사전 검증")
async def validate_backup(
    request: BackupImportRequest,
    use_cases: BackupUseCases = Depends(get_use_cases),
    _: dict = Depends(require_write_access),
):
    try:
        return BackupValidateResponse(**(await use_cases.validate_payload(request.data.model_dump())))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
