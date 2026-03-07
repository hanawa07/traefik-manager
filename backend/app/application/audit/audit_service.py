import logging
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.infrastructure.persistence.models import AuditLogModel

logger = logging.getLogger(__name__)

async def record(
    db: AsyncSession,
    actor: str,
    action: str,
    resource_type: str,
    resource_id: str,
    resource_name: str,
    detail: dict[str, Any] | None = None,
) -> None:
    """감사 로그를 DB에 기록합니다. 기록 실패 시 로그만 남기고 예외를 발생시키지 않습니다."""
    try:
        audit_log = AuditLogModel(
            actor=actor,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            resource_name=resource_name,
            detail=detail,
        )
        db.add(audit_log)
        await db.flush()  # 호출한 곳에서 세션을 커밋할 것이므로 flush만 수행
    except Exception as e:
        logger.error(f"Failed to record audit log: {e}", exc_info=True)
