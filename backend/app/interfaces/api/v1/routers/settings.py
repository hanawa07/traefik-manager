from fastapi import APIRouter, Depends

from app.infrastructure.cloudflare.client import CloudflareClient
from app.interfaces.api.dependencies import get_current_user
from app.interfaces.api.v1.schemas.settings_schemas import CloudflareSettingsStatusResponse

router = APIRouter()


def get_cloudflare_client() -> CloudflareClient:
    return CloudflareClient()


@router.get("/cloudflare", response_model=CloudflareSettingsStatusResponse, summary="Cloudflare 설정 상태")
async def get_cloudflare_status(
    cloudflare_client: CloudflareClient = Depends(get_cloudflare_client),
    _: dict = Depends(get_current_user),
):
    return cloudflare_client.get_status()
