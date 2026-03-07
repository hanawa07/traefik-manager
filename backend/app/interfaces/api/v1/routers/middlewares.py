from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.proxy.middleware_template_use_cases import MiddlewareTemplateUseCases
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.repositories.sqlite_middleware_template_repository import (
    SQLiteMiddlewareTemplateRepository,
)
from app.infrastructure.persistence.repositories.sqlite_service_repository import (
    SQLiteServiceRepository,
)
from app.interfaces.api.dependencies import get_current_user, require_write_access
from app.interfaces.api.v1.schemas.middleware_schemas import (
    MiddlewareTemplateCreate,
    MiddlewareTemplateResponse,
    MiddlewareTemplateUpdate,
)

router = APIRouter()


def get_use_cases(db: AsyncSession = Depends(get_db)) -> MiddlewareTemplateUseCases:
    return MiddlewareTemplateUseCases(
        repository=SQLiteMiddlewareTemplateRepository(db),
        service_repository=SQLiteServiceRepository(db),
    )


@router.get("/", response_model=list[MiddlewareTemplateResponse], summary="미들웨어 템플릿 목록")
async def list_templates(
    use_cases: MiddlewareTemplateUseCases = Depends(get_use_cases),
    _: dict = Depends(get_current_user),
):
    return await use_cases.list_templates()


@router.post("/", response_model=MiddlewareTemplateResponse, status_code=status.HTTP_201_CREATED, summary="미들웨어 템플릿 추가")
async def create_template(
    data: MiddlewareTemplateCreate,
    use_cases: MiddlewareTemplateUseCases = Depends(get_use_cases),
    _: dict = Depends(require_write_access),
):
    try:
        return await use_cases.create_template(data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/{template_id}", response_model=MiddlewareTemplateResponse, summary="미들웨어 템플릿 조회")
async def get_template(
    template_id: UUID,
    use_cases: MiddlewareTemplateUseCases = Depends(get_use_cases),
    _: dict = Depends(get_current_user),
):
    template = await use_cases.get_template(template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="미들웨어 템플릿을 찾을 수 없습니다")
    return template


@router.put("/{template_id}", response_model=MiddlewareTemplateResponse, summary="미들웨어 템플릿 수정")
async def update_template(
    template_id: UUID,
    data: MiddlewareTemplateUpdate,
    use_cases: MiddlewareTemplateUseCases = Depends(get_use_cases),
    _: dict = Depends(require_write_access),
):
    try:
        template = await use_cases.update_template(template_id, data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="미들웨어 템플릿을 찾을 수 없습니다")
    return template


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT, summary="미들웨어 템플릿 삭제")
async def delete_template(
    template_id: UUID,
    use_cases: MiddlewareTemplateUseCases = Depends(get_use_cases),
    _: dict = Depends(require_write_access),
):
    try:
        await use_cases.delete_template(template_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
