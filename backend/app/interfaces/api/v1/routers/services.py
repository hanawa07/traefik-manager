from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.interfaces.api.dependencies import get_current_user
from app.interfaces.api.v1.schemas.service_schemas import ServiceCreate, ServiceUpdate, ServiceResponse
from app.application.proxy.service_use_cases import ServiceUseCases
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.repositories.sqlite_service_repository import SQLiteServiceRepository
from app.infrastructure.traefik.file_provider_writer import FileProviderWriter
from app.infrastructure.authentik.client import AuthentikClient

router = APIRouter()


def get_use_cases(db: AsyncSession = Depends(get_db)) -> ServiceUseCases:
    return ServiceUseCases(
        repository=SQLiteServiceRepository(db),
        file_writer=FileProviderWriter(),
        authentik_client=AuthentikClient(),
    )


@router.get("/", response_model=list[ServiceResponse], summary="서비스 목록")
async def list_services(
    use_cases: ServiceUseCases = Depends(get_use_cases),
    _: dict = Depends(get_current_user),
):
    return await use_cases.list_services()


@router.post("/", response_model=ServiceResponse, status_code=status.HTTP_201_CREATED, summary="서비스 추가")
async def create_service(
    data: ServiceCreate,
    use_cases: ServiceUseCases = Depends(get_use_cases),
    _: dict = Depends(get_current_user),
):
    return await use_cases.create_service(data)


@router.get("/{service_id}", response_model=ServiceResponse, summary="서비스 조회")
async def get_service(
    service_id: UUID,
    use_cases: ServiceUseCases = Depends(get_use_cases),
    _: dict = Depends(get_current_user),
):
    service = await use_cases.get_service(service_id)
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="서비스를 찾을 수 없습니다")
    return service


@router.patch("/{service_id}", response_model=ServiceResponse, summary="서비스 수정")
async def update_service(
    service_id: UUID,
    data: ServiceUpdate,
    use_cases: ServiceUseCases = Depends(get_use_cases),
    _: dict = Depends(get_current_user),
):
    service = await use_cases.update_service(service_id, data)
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="서비스를 찾을 수 없습니다")
    return service


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT, summary="서비스 삭제")
async def delete_service(
    service_id: UUID,
    use_cases: ServiceUseCases = Depends(get_use_cases),
    _: dict = Depends(get_current_user),
):
    await use_cases.delete_service(service_id)
