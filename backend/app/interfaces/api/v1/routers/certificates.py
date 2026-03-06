from fastapi import APIRouter, Depends
from app.interfaces.api.dependencies import get_current_user

router = APIRouter()


@router.get("/", summary="인증서 목록")
async def list_certificates(_: dict = Depends(get_current_user)):
    # TODO: Traefik API에서 인증서 상태 조회
    return []
