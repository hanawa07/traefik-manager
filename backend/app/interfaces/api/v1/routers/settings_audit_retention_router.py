from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.audit import audit_service
from app.core.config import settings
from app.core.logging_config import get_client_ip
from app.infrastructure.persistence.audit_retention import (
    AUDIT_ARCHIVE_ENABLED_KEY,
    AUDIT_RETENTION_DAYS_KEY,
    read_audit_retention_status,
    run_audit_retention_once,
)
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import (
    SQLiteSystemSettingsRepository,
)
from app.interfaces.api.dependencies import get_current_user, require_admin
from app.interfaces.api.v1.schemas.settings_audit_retention_schemas import (
    AuditRetentionSettingsResponse,
    AuditRetentionSettingsUpdateRequest,
)

router = APIRouter()


@router.get("/audit-retention", response_model=AuditRetentionSettingsResponse)
async def get_audit_retention_settings(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    return await read_audit_retention_status(SQLiteSystemSettingsRepository(db))


@router.put("/audit-retention", response_model=AuditRetentionSettingsResponse)
async def update_audit_retention_settings(
    payload: AuditRetentionSettingsUpdateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: dict = Depends(require_admin),
):
    repository = SQLiteSystemSettingsRepository(db)
    await repository.set(AUDIT_RETENTION_DAYS_KEY, str(payload.retention_days))
    await repository.set(AUDIT_ARCHIVE_ENABLED_KEY, str(payload.archive_enabled).lower())
    await audit_service.record(
        db=db,
        actor=actor["username"],
        action="update",
        resource_type="settings",
        resource_id="audit-retention",
        resource_name="감사 로그 보존 정책",
        detail={
            "event": "settings_update_audit_retention",
            "retention_days": payload.retention_days,
            "archive_enabled": payload.archive_enabled,
            "client_ip": get_client_ip(request),
        },
    )
    return await read_audit_retention_status(repository)


@router.post("/audit-retention/run", response_model=AuditRetentionSettingsResponse)
async def run_audit_retention_cleanup(
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: dict = Depends(require_admin),
):
    result = await run_audit_retention_once(db, archive_dir=settings.AUDIT_ARCHIVE_DIR)
    await audit_service.record(
        db=db,
        actor=actor["username"],
        action="cleanup",
        resource_type="settings",
        resource_id="audit-retention",
        resource_name="감사 로그 보존 정책",
        detail={
            "event": "audit_retention_cleanup",
            "archived_count": result["last_archived_count"],
            "deleted_count": result["last_deleted_count"],
            "client_ip": get_client_ip(request),
        },
    )
    return result
