from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token, get_token_expiration
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.repositories.sqlite_revoked_token_repository import (
    SQLiteRevokedTokenRepository,
)
from app.infrastructure.persistence.repositories.sqlite_user_repository import (
    SQLiteUserRepository,
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def resolve_authenticated_user(token: str, db: AsyncSession):
    payload = decode_token(token)
    username = payload.get("sub")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 토큰입니다",
        )

    jti = payload.get("jti")
    if jti:
        revoked_repository = SQLiteRevokedTokenRepository(db)
        if await revoked_repository.is_revoked(jti):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="로그아웃된 토큰입니다. 다시 로그인해주세요",
                headers={"WWW-Authenticate": "Bearer"},
            )

    repository = SQLiteUserRepository(db)
    user = await repository.find_by_username(username)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 토큰입니다",
        )

    if payload.get("ver", 0) != user.token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="만료된 토큰입니다. 다시 로그인해주세요",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user, payload


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> dict:
    user, payload = await resolve_authenticated_user(token=token, db=db)

    return {
        "id": str(user.id),
        "username": user.username,
        "role": user.role,
        "token_jti": payload.get("jti"),
        "token_exp": get_token_expiration(payload),
    }


async def require_write_access(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="읽기 전용 계정은 변경 작업을 수행할 수 없습니다",
        )
    return current_user


async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자 권한이 필요합니다",
        )
    return current_user
