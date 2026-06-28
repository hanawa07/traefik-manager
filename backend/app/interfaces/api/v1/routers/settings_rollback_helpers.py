from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time_display import normalize_display_timezone
from app.infrastructure.persistence.models import AuditLogModel
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import SQLiteSystemSettingsRepository
from app.interfaces.api.v1.routers.settings_events import SETTINGS_ROLLBACK_EVENTS, SETTINGS_UPDATE_EVENTS
from app.interfaces.api.v1.routers.settings_response_builders import build_upstream_security_response
from app.interfaces.api.v1.routers.settings_summary_helpers import upstream_security_summary


async def load_supported_settings_rollback(
    db: AsyncSession,
    audit_log_id: str,
) -> tuple[AuditLogModel, str, dict[str, object], str]:
    result = await db.execute(select(AuditLogModel).where(AuditLogModel.id == audit_log_id))
    audit_log = result.scalar_one_or_none()
    if audit_log is None:
        raise HTTPException(status_code=404, detail="대상 설정 변경 로그를 찾을 수 없습니다")
    if audit_log.resource_type != "settings" or audit_log.action != "update":
        raise HTTPException(status_code=422, detail="설정 변경 로그만 롤백할 수 있습니다")

    detail = audit_log.detail or {}
    event = detail.get("event")
    rollback_supported = detail.get("rollback_supported") is True
    rollback_payload = detail.get("rollback_payload")
    if not isinstance(event, str) or not rollback_supported or not isinstance(rollback_payload, dict):
        raise HTTPException(status_code=422, detail="이 설정 변경은 안전 롤백을 지원하지 않습니다")
    rollback_event = SETTINGS_ROLLBACK_EVENTS.get(event)
    if rollback_event is None:
        raise HTTPException(status_code=422, detail="이 설정 변경은 안전 롤백을 지원하지 않습니다")
    return audit_log, event, rollback_payload, rollback_event


async def get_current_settings_summary_for_event(
    repo: SQLiteSystemSettingsRepository,
    event: str,
) -> dict[str, object]:
    if event == SETTINGS_UPDATE_EVENTS["time_display"]:
        return {"display_timezone": normalize_display_timezone(await repo.get("display_timezone"))}
    if event == SETTINGS_UPDATE_EVENTS["upstream_security"]:
        return upstream_security_summary(await build_upstream_security_response(repo))
    raise HTTPException(status_code=422, detail="이 설정 변경은 안전 롤백을 지원하지 않습니다")


async def apply_settings_rollback(
    repo: SQLiteSystemSettingsRepository,
    event: str,
    rollback_payload: dict[str, object],
) -> dict[str, object]:
    if event == SETTINGS_UPDATE_EVENTS["time_display"]:
        display_timezone = rollback_payload.get("display_timezone")
        if not isinstance(display_timezone, str):
            raise HTTPException(status_code=422, detail="유효한 표시 시간대 복원 정보가 없습니다")
        await repo.set("display_timezone", display_timezone)
        return {"display_timezone": normalize_display_timezone(await repo.get("display_timezone"))}

    if event == SETTINGS_UPDATE_EVENTS["upstream_security"]:
        allowed_domain_suffixes = rollback_payload.get("allowed_domain_suffixes")
        if not isinstance(allowed_domain_suffixes, list) or not all(
            isinstance(item, str) for item in allowed_domain_suffixes
        ):
            raise HTTPException(status_code=422, detail="유효한 업스트림 보안 복원 정보가 없습니다")

        await repo.set(
            "upstream_dns_strict_mode",
            "true" if rollback_payload.get("dns_strict_mode") else "false",
        )
        await repo.set(
            "upstream_allowlist_enabled",
            "true" if rollback_payload.get("allowlist_enabled") else "false",
        )
        await repo.set(
            "upstream_allowed_domain_suffixes",
            "\n".join(allowed_domain_suffixes),
        )
        await repo.set(
            "upstream_allow_docker_service_names",
            "true" if rollback_payload.get("allow_docker_service_names") else "false",
        )
        await repo.set(
            "upstream_allow_private_networks",
            "true" if rollback_payload.get("allow_private_networks") else "false",
        )
        return upstream_security_summary(await build_upstream_security_response(repo))

    raise HTTPException(status_code=422, detail="이 설정 변경은 안전 롤백을 지원하지 않습니다")
