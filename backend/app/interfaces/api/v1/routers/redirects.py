from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.proxy.redirect_host_use_cases import RedirectHostUseCases
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.repositories.sqlite_redirect_host_repository import (
    SQLiteRedirectHostRepository,
)
from app.infrastructure.persistence.repositories.sqlite_service_repository import (
    SQLiteServiceRepository,
)
from app.infrastructure.traefik.file_provider_writer import FileProviderWriter
from app.interfaces.api.dependencies import get_current_user
from app.interfaces.api.v1.schemas.redirect_schemas import (
    RedirectHostCreate,
    RedirectHostResponse,
    RedirectHostUpdate,
)

router = APIRouter()


def get_use_cases(db: AsyncSession = Depends(get_db)) -> RedirectHostUseCases:
    return RedirectHostUseCases(
        repository=SQLiteRedirectHostRepository(db),
        service_repository=SQLiteServiceRepository(db),
        file_writer=FileProviderWriter(),
    )


@router.get("/", response_model=list[RedirectHostResponse], summary="리다이렉트 목록")
async def list_redirect_hosts(
    use_cases: RedirectHostUseCases = Depends(get_use_cases),
    _: dict = Depends(get_current_user),
):
    return await use_cases.list_redirect_hosts()


@router.post("/", response_model=RedirectHostResponse, status_code=status.HTTP_201_CREATED, summary="리다이렉트 추가")
async def create_redirect_host(
    data: RedirectHostCreate,
    use_cases: RedirectHostUseCases = Depends(get_use_cases),
    _: dict = Depends(get_current_user),
):
    try:
        return await use_cases.create_redirect_host(data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/{redirect_id}", response_model=RedirectHostResponse, summary="리다이렉트 조회")
async def get_redirect_host(
    redirect_id: UUID,
    use_cases: RedirectHostUseCases = Depends(get_use_cases),
    _: dict = Depends(get_current_user),
):
    redirect_host = await use_cases.get_redirect_host(redirect_id)
    if not redirect_host:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="리다이렉트를 찾을 수 없습니다")
    return redirect_host


@router.patch("/{redirect_id}", response_model=RedirectHostResponse, summary="리다이렉트 수정")
async def update_redirect_host(
    redirect_id: UUID,
    data: RedirectHostUpdate,
    use_cases: RedirectHostUseCases = Depends(get_use_cases),
    _: dict = Depends(get_current_user),
):
    try:
        redirect_host = await use_cases.update_redirect_host(redirect_id, data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if not redirect_host:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="리다이렉트를 찾을 수 없습니다")
    return redirect_host


@router.delete("/{redirect_id}", status_code=status.HTTP_204_NO_CONTENT, summary="리다이렉트 삭제")
async def delete_redirect_host(
    redirect_id: UUID,
    use_cases: RedirectHostUseCases = Depends(get_use_cases),
    _: dict = Depends(get_current_user),
):
    await use_cases.delete_redirect_host(redirect_id)
