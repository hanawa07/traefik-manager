import logging
from datetime import timedelta
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def reject_failed_login(
    *,
    form,
    auth_result,
    db: AsyncSession,
    current,
    client_ip: str,
    trusted_networks: list[str],
    audit_service_module,
    login_anomaly_service_module,
    settings_obj: Any,
) -> None:
    event = "login_locked" if auth_result.failure_reason == "locked" else "login_failure"
    await audit_service_module.record(
        db=db,
        actor=form.username.strip() or "anonymous",
        action="update",
        resource_type="user",
        resource_id=(
            str(auth_result.subject_user.id)
            if auth_result.subject_user
            else (form.username.strip() or "unknown")[:36]
        ),
        resource_name=(
            auth_result.subject_user.username
            if auth_result.subject_user
            else (form.username.strip() or "unknown")
        ),
        detail={
            "event": event,
            "client_ip": client_ip,
            "locked_until": (
                auth_result.locked_until.isoformat()
                if auth_result.locked_until is not None
                else None
            ),
        },
    )
    await login_anomaly_service_module.record_suspicious_login_activity_if_needed(
        db=db,
        client_ip=client_ip,
        now=current,
        window=timedelta(minutes=settings_obj.LOGIN_SUSPICIOUS_WINDOW_MINUTES),
        min_failures=settings_obj.LOGIN_SUSPICIOUS_FAILURE_COUNT,
        min_unique_usernames=settings_obj.LOGIN_SUSPICIOUS_USERNAME_COUNT,
        trusted_networks=trusted_networks,
    )
    logger.warning(
        "로그인 실패: username=%s reason=%s",
        form.username,
        auth_result.failure_reason,
        extra={
            "client_ip": client_ip,
            "failure_reason": auth_result.failure_reason,
            "locked_until": (
                auth_result.locked_until.isoformat()
                if auth_result.locked_until is not None
                else None
            ),
        },
    )
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="아이디 또는 비밀번호가 올바르지 않습니다",
    )
