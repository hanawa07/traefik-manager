from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.models import AuditLogModel
from app.interfaces.api.v1.routers.settings_audit_helpers import build_settings_test_history_response
from app.interfaces.api.v1.schemas.settings_schemas import SettingsTestHistoryResponse


async def get_settings_test_history_response(db: AsyncSession) -> SettingsTestHistoryResponse:
    result = await db.execute(
        select(AuditLogModel)
        .where(AuditLogModel.resource_type == "settings")
        .order_by(desc(AuditLogModel.created_at))
    )
    logs = result.scalars().all()
    return build_settings_test_history_response(logs)
