from copy import deepcopy
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.user_use_cases import UserUseCases
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.models import AuditLogModel
from app.infrastructure.persistence.repositories.sqlite_user_repository import (
    SQLiteUserRepository,
)
from app.interfaces.api.dependencies import require_admin
from app.application.audit import audit_service
from app.interfaces.api.v1.schemas.user_schemas import (
    UserCreate,
    UserListResponse,
    UserResponse,
    UserUpdate,
)

router = APIRouter()
USER_UPDATE_EVENT = "user_update"
USER_ROLLBACK_EVENT = "user_rollback"


def get_use_cases(db: AsyncSession = Depends(get_db)) -> UserUseCases:
    return UserUseCases(SQLiteUserRepository(db))


@router.get("", response_model=UserListResponse, summary="사용자 목록")
async def list_users(
    use_cases: UserUseCases = Depends(get_use_cases),
    _: dict = Depends(require_admin),
):
    return UserListResponse(users=await use_cases.list_users())


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED, summary="사용자 추가")
async def create_user(
    data: UserCreate,
    use_cases: UserUseCases = Depends(get_use_cases),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    try:
        user = await use_cases.create_user(data)
        await audit_service.record(
            db=db,
            actor=current_user["username"],
            action="create",
            resource_type="user",
            resource_id=str(user.id),
            resource_name=user.username,
            detail={"role": user.role},
        )
        return user
    except ValueError as exc:

        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.put("/{user_id}", response_model=UserResponse, summary="사용자 수정")
async def update_user(
    user_id: UUID,
    data: UserUpdate,
    use_cases: UserUseCases = Depends(get_use_cases),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    try:
        before_user = await _get_user_for_update(use_cases, user_id)
        update_payload = data.model_dump(exclude_unset=True)
        user = await use_cases.update_user(user_id, data)
        if user and before_user:
            before_summary = _user_audit_summary(before_user, password_changed=False)
            after_summary = _user_audit_summary(user, password_changed="password" in update_payload)
            changed_keys = sorted(
                [
                    key
                    for key in set(before_summary.keys()) | set(after_summary.keys())
                    if before_summary.get(key) != after_summary.get(key)
                ]
            )
            rollback_payload = _build_user_rollback_payload(before_summary, changed_keys, update_payload)
            await audit_service.record(
                db=db,
                actor=current_user["username"],
                action="update",
                resource_type="user",
                resource_id=str(user.id),
                resource_name=user.username,
                detail={
                    "event": USER_UPDATE_EVENT,
                    "changed_keys": changed_keys,
                    "before": before_summary,
                    "after": after_summary,
                    "summary": after_summary,
                    "rollback_supported": rollback_payload is not None,
                    **({"rollback_payload": rollback_payload} if rollback_payload is not None else {}),
                },
            )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자를 찾을 수 없습니다")
    return user


@router.post(
    "/rollback/{audit_log_id}",
    response_model=UserResponse,
    summary="사용자 변경 롤백",
)
async def rollback_user_change(
    audit_log_id: str,
    use_cases: UserUseCases = Depends(get_use_cases),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    result = await db.execute(select(AuditLogModel).where(AuditLogModel.id == audit_log_id))
    audit_log = result.scalar_one_or_none()
    if audit_log is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="대상 사용자 변경 로그를 찾을 수 없습니다")
    if audit_log.resource_type != "user" or audit_log.action != "update":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="사용자 변경 로그만 롤백할 수 있습니다")

    detail = audit_log.detail or {}
    rollback_payload = detail.get("rollback_payload")
    if (
        detail.get("event") != USER_UPDATE_EVENT
        or detail.get("rollback_supported") is not True
        or not isinstance(rollback_payload, dict)
    ):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="이 사용자 변경은 안전 롤백을 지원하지 않습니다")

    current_user_entity = await _get_user_for_update(use_cases, UUID(audit_log.resource_id))
    if current_user_entity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자를 찾을 수 없습니다")

    before_summary = _user_audit_summary(current_user_entity, password_changed=False)
    updated_user = await use_cases.update_user(UUID(audit_log.resource_id), UserUpdate(**rollback_payload))
    if updated_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자를 찾을 수 없습니다")

    after_summary = _user_audit_summary(updated_user, password_changed=False)
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
        resource_type="user",
        resource_id=str(updated_user.id),
        resource_name=updated_user.username,
        detail={
            "event": USER_ROLLBACK_EVENT,
            "source_audit_id": audit_log_id,
            "changed_keys": changed_keys,
            "before": before_summary,
            "after": after_summary,
            "summary": after_summary,
        },
    )
    return updated_user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT, summary="사용자 삭제")
async def delete_user(
    user_id: UUID,
    use_cases: UserUseCases = Depends(get_use_cases),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    user = await use_cases.repository.find_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자를 찾을 수 없습니다")
        
    try:
        await use_cases.delete_user(user_id)
        await audit_service.record(
            db=db,
            actor=current_user["username"],
            action="delete",
            resource_type="user",
            resource_id=str(user_id),
            resource_name=user.username,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


async def _get_user_for_update(use_cases: UserUseCases, user_id: UUID):
    get_user = getattr(use_cases, "get_user", None)
    if callable(get_user):
        return await get_user(user_id)
    return await use_cases.repository.find_by_id(user_id)


def _user_audit_summary(user, *, password_changed: bool) -> dict[str, object]:
    return {
        "username": getattr(user, "username", ""),
        "role": getattr(user, "role", ""),
        "is_active": bool(getattr(user, "is_active", True)),
        "password_changed": password_changed,
    }


def _build_user_rollback_payload(
    before_summary: dict[str, object],
    changed_keys: list[str],
    update_payload: dict[str, object],
) -> dict[str, object] | None:
    if "password" in update_payload:
        return None

    payload: dict[str, object] = {}
    for key in changed_keys:
        if key in {"username", "role", "is_active"}:
            payload[key] = deepcopy(before_summary[key])
    return payload or None
