from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.audit import audit_service
from app.core.logging_config import get_client_ip
from app.infrastructure.github_api_rate_limit import (
    github_api_manual_refresh_block_message,
    read_github_api_rate_limit_event,
)
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import (
    SQLiteSystemSettingsRepository,
)
from app.interfaces.api.dependencies import get_current_user, require_admin
from app.interfaces.api.v1.routers.settings_github_api_rate_limit_audit import (
    record_github_api_rate_limit_audit,
)
from app.interfaces.api.v1.routers.settings_smoke_monitoring_action import (
    update_smoke_monitoring_settings_action as _update_smoke_monitoring_settings_action,
)
from app.interfaces.api.v1.routers.settings_smoke_monitoring_values import (
    read_smoke_monitoring_values,
    should_run_scheduled_smoke,
)
from app.interfaces.api.v1.routers.settings_smoke_rotation_response import (
    get_smoke_rotation_status_response as _get_smoke_rotation_status_response,
)
from app.interfaces.api.v1.routers.settings_smoke_run_action import (
    record_smoke_run_failure_action as _record_smoke_run_failure_action,
    record_smoke_run_success_action as _record_smoke_run_success_action,
)
from app.interfaces.api.v1.schemas.settings_schemas import (
    SmokeMonitoringRunFailureRequest,
    SmokeMonitoringRunFailureResponse,
    SmokeMonitoringRunSuccessRequest,
    SmokeMonitoringRunSuccessResponse,
    SmokeMonitoringScheduleDecisionResponse,
    SmokeMonitoringSettingsUpdateRequest,
    SmokeRotationStatusResponse,
)

router = APIRouter()


# Scheduled Actions reads this non-sensitive boolean before creating a viewer session.
@router.get(
    "/smoke-schedule-decision",
    response_model=SmokeMonitoringScheduleDecisionResponse,
    summary="예약 운영 스모크 실행 여부 조회",
)
async def get_smoke_schedule_decision(
    db: AsyncSession = Depends(get_db),
):
    repo = SQLiteSystemSettingsRepository(db)
    monitoring = await read_smoke_monitoring_values(repo)
    return SmokeMonitoringScheduleDecisionResponse(
        should_run=should_run_scheduled_smoke(monitoring),
    )


@router.get(
    "/smoke-rotation",
    response_model=SmokeRotationStatusResponse,
    summary="운영 로그인·화면 점검과 스모크 계정 회전 상태 조회",
)
async def get_smoke_rotation_status(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    refresh_monitoring_history: bool = False,
    summary: bool = False,
    history: bool = False,
    history_days: int | None = None,
    history_page: int = 1,
    history_search: str | None = None,
    history_status: str = "all",
    history_cancellation_reason: str = "all",
):
    if history_days not in {None, 7, 30}:
        raise HTTPException(status_code=422, detail="history_days는 7 또는 30이어야 합니다")
    if history_page < 1:
        raise HTTPException(status_code=422, detail="history_page는 1 이상이어야 합니다")
    normalized_search = (history_search or "").strip()
    if len(normalized_search) > 100:
        raise HTTPException(status_code=422, detail="history_search는 100자 이하여야 합니다")
    if history_status not in {"all", "success", "failure", "cancelled"}:
        raise HTTPException(status_code=422, detail="history_status 값을 확인해주세요")
    if history_cancellation_reason not in {
        "all",
        "timeout",
        "superseded",
        "manual_or_unknown",
    }:
        raise HTTPException(status_code=422, detail="history_cancellation_reason 값을 확인해주세요")
    if history_cancellation_reason != "all" and history_status != "cancelled":
        raise HTTPException(
            status_code=422,
            detail="취소 원인 필터는 취소 상태에서만 사용할 수 있습니다",
        )
    is_admin = current_user["role"] == "admin"
    include_admin_details = is_admin and not summary
    include_monitoring_history = include_admin_details or (is_admin and history)
    if include_admin_details and refresh_monitoring_history:
        refresh_block_message = github_api_manual_refresh_block_message()
        if refresh_block_message:
            raise HTTPException(status_code=429, detail=refresh_block_message)
    event_before = read_github_api_rate_limit_event()
    response = await _get_smoke_rotation_status_response(
        db,
        include_recent_logs=include_admin_details,
        include_monitoring_history=include_monitoring_history,
        monitoring_history_days=(history_days or 30) if include_monitoring_history else None,
        monitoring_history_page=history_page,
        monitoring_history_search=normalized_search,
        monitoring_history_status=history_status,
        monitoring_history_cancellation_reason=history_cancellation_reason,
        force_refresh_monitoring_history=include_admin_details and refresh_monitoring_history,
    )
    event_after = read_github_api_rate_limit_event()
    before_value = event_before.get("sequence") if event_before else None
    after_value = event_after.get("sequence") if event_after else None
    before_sequence = before_value if isinstance(before_value, int) else 0
    after_sequence = after_value if isinstance(after_value, int) else 0
    if include_monitoring_history and event_after and after_sequence > before_sequence:
        await record_github_api_rate_limit_audit(
            audit_service=audit_service,
            db=db,
            actor=current_user["username"],
            rate_limit_event=event_after,
        )
    return response


@router.post(
    "/smoke-run-success",
    response_model=SmokeMonitoringRunSuccessResponse,
    summary="원격 운영 스모크 성공 결과 기록",
)
async def record_smoke_run_success(
    request: SmokeMonitoringRunSuccessRequest,
    db: AsyncSession = Depends(get_db),
    actor: dict = Depends(get_current_user),
):
    return await _record_smoke_run_success_action(
        run_id=request.run_id,
        admin_checked=request.admin_checked,
        actor=actor,
        db=db,
        settings_repository_factory=SQLiteSystemSettingsRepository,
    )


@router.post(
    "/smoke-run-failure",
    response_model=SmokeMonitoringRunFailureResponse,
    summary="원격 운영 스모크 실패 메타데이터 기록",
)
async def record_smoke_run_failure(
    request: SmokeMonitoringRunFailureRequest,
    db: AsyncSession = Depends(get_db),
    actor: dict = Depends(get_current_user),
):
    return await _record_smoke_run_failure_action(
        request=request,
        actor=actor,
        db=db,
        settings_repository_factory=SQLiteSystemSettingsRepository,
    )


@router.put(
    "/smoke-rotation",
    response_model=SmokeRotationStatusResponse,
    summary="운영 로그인·화면 점검 예약 설정 저장",
)
async def update_smoke_monitoring_settings(
    request: SmokeMonitoringSettingsUpdateRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db),
    actor: dict = Depends(require_admin),
):
    return await _update_smoke_monitoring_settings_action(
        request=request,
        http_request=http_request,
        db=db,
        actor=actor,
        settings_repository_factory=SQLiteSystemSettingsRepository,
        audit_service=audit_service,
        client_ip_getter=_maybe_get_client_ip,
    )


def _maybe_get_client_ip(http_request: Request | None) -> str | None:
    if http_request is None:
        return None
    return get_client_ip(http_request)
