from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.user_use_cases import UserUseCases
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.repositories.sqlite_user_repository import (
    SQLiteUserRepository,
)
from app.interfaces.api.dependencies import require_admin
from app.interfaces.api.v1.schemas.user_schemas import (
    UserCreate,
    UserListResponse,
    UserResponse,
    UserUpdate,
)

router = APIRouter()


def get_use_cases(db: AsyncSession = Depends(get_db)) -> UserUseCases:
    return UserUseCases(SQLiteUserRepository(db))


@router.get("/", response_model=UserListResponse, summary="사용자 목록")
async def list_users(
    use_cases: UserUseCases = Depends(get_use_cases),
    _: dict = Depends(require_admin),
):
    return UserListResponse(users=await use_cases.list_users())


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED, summary="사용자 추가")
async def create_user(
    data: UserCreate,
    use_cases: UserUseCases = Depends(get_use_cases),
    _: dict = Depends(require_admin),
):
    try:
        return await use_cases.create_user(data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.put("/{user_id}", response_model=UserResponse, summary="사용자 수정")
async def update_user(
    user_id: UUID,
    data: UserUpdate,
    use_cases: UserUseCases = Depends(get_use_cases),
    _: dict = Depends(require_admin),
):
    try:
        user = await use_cases.update_user(user_id, data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자를 찾을 수 없습니다")
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT, summary="사용자 삭제")
async def delete_user(
    user_id: UUID,
    use_cases: UserUseCases = Depends(get_use_cases),
    _: dict = Depends(require_admin),
):
    try:
        await use_cases.delete_user(user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
