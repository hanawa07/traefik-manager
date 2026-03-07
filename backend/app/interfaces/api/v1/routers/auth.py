import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.auth_use_cases import AuthUseCases
from app.core.logging_config import get_client_ip
from app.core.security import create_access_token
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.repositories.sqlite_user_repository import (
    SQLiteUserRepository,
)
from app.interfaces.api.v1.schemas.auth_schemas import LoginResponse

router = APIRouter()
logger = logging.getLogger(__name__)


def get_use_cases(db: AsyncSession = Depends(get_db)) -> AuthUseCases:
    return AuthUseCases(SQLiteUserRepository(db))


@router.post("/login", response_model=LoginResponse, summary="로그인")
async def login(
    request: Request,
    form: OAuth2PasswordRequestForm = Depends(),
    use_cases: AuthUseCases = Depends(get_use_cases),
):
    user = await use_cases.authenticate_user(form.username, form.password)
    if not user:
        logger.warning(
            "로그인 실패: username=%s",
            form.username,
            extra={"client_ip": get_client_ip(request)},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="아이디 또는 비밀번호가 올바르지 않습니다",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(
        {
            "sub": user.username,
            "uid": str(user.id),
            "role": user.role,
        }
    )
    logger.info(
        "로그인 성공: username=%s",
        user.username,
        extra={"client_ip": get_client_ip(request)},
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "username": user.username,
        "role": user.role,
    }
