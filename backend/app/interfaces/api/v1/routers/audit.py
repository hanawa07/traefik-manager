from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import Optional

from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.models import AuditLogModel
from app.interfaces.api.dependencies import get_current_user
from app.interfaces.api.v1.schemas.audit_schemas import AuditLogResponse

router = APIRouter()

@router.get("", response_model=list[AuditLogResponse], summary="감사 로그 조회")
async def list_audit_logs(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    resource_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """
    시스템 변경 이력(감사 로그)을 최신순으로 조회합니다.
    """
    query = select(AuditLogModel).order_by(desc(AuditLogModel.created_at))
    
    if resource_type:
        query = query.where(AuditLogModel.resource_type == resource_type)
        
    query = query.limit(limit).offset(offset)
    
    result = await db.execute(query)
    logs = result.scalars().all()
    
    return logs
