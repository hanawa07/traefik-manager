import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.auth_use_cases import AuthUseCases
from app.core.logging_config import get_client_ip
from app.core.security import create_access_token
from app.domain.auth.entities.revoked_token import RevokedToken
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.models import ServiceModel
from app.infrastructure.persistence.repositories.sqlite_revoked_token_repository import (
    SQLiteRevokedTokenRepository,
)
from app.infrastructure.persistence.repositories.sqlite_user_repository import (
    SQLiteUserRepository,
)
from app.interfaces.api.dependencies import get_current_user, resolve_authenticated_user
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
        },
        token_version=user.token_version,
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


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="로그아웃")
async def logout(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    token_jti = current_user.get("token_jti")
    token_exp = current_user.get("token_exp")
    if token_jti and token_exp:
        repository = SQLiteRevokedTokenRepository(db)
        await repository.save(
            RevokedToken.revoke(
                jti=token_jti,
                expires_at=token_exp,
                username=current_user["username"],
            )
        )
    else:
        repository = SQLiteUserRepository(db)
        user = await repository.find_by_username(current_user["username"])
        if user:
            user.invalidate_tokens()
            await repository.save(user)
    logger.info("로그아웃: username=%s", current_user["username"])


@router.get(
    "/verify",
    status_code=200,
    summary="Traefik forwardAuth 토큰 검증",
    include_in_schema=False,
)
async def verify_token(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Traefik forwardAuth 미들웨어가 호출하는 엔드포인트.
    1. 서비스 전용 API Key 검증 (우선)
    2. 관리자 JWT 토큰 검증 (브라우저 접근용)
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return Response(status_code=401)

    token = auth_header[7:]

    # 1. 서비스 전용 API Key 검증 시도
    forwarded_host = request.headers.get("X-Forwarded-Host")
    if forwarded_host:
        result = await db.execute(
            select(ServiceModel).where(ServiceModel.domain == forwarded_host)
        )
        service = result.scalar_one_or_none()

        if service and service.auth_mode == "token" and service.api_key == token:
            return Response(
                status_code=200,
                headers={
                    "X-Auth-User": f"api-key-{service.name}",
                    "X-Auth-Role": "api",
                },
            )

    # 2. 관리자 JWT 토큰 검증
    try:
        user, _payload = await resolve_authenticated_user(token=token, db=db)
        return Response(
            status_code=200,
            headers={
                "X-Auth-User": user.username,
                "X-Auth-Role": user.role,
            },
        )
    except HTTPException:
        pass

    return Response(status_code=401)
