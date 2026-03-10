from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time_display import (
    get_display_timezone_label,
    get_display_timezone_name,
    get_server_time_context,
    normalize_display_timezone,
)
from app.infrastructure.cloudflare.client import CloudflareClient
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import SQLiteSystemSettingsRepository
from app.interfaces.api.dependencies import get_current_user, require_admin
from app.interfaces.api.v1.schemas.settings_schemas import (
    CloudflareSettingsStatusResponse,
    CloudflareSettingsUpdateRequest,
    TimeDisplaySettingsResponse,
    TimeDisplaySettingsUpdateRequest,
)

router = APIRouter()


async def get_cloudflare_client(db: AsyncSession = Depends(get_db)) -> CloudflareClient:
    repo = SQLiteSystemSettingsRepository(db)
    db_settings = await repo.get_all_dict()
    return CloudflareClient.from_db_settings(db_settings)


@router.get("/cloudflare", response_model=CloudflareSettingsStatusResponse, summary="Cloudflare 설정 상태")
async def get_cloudflare_status(
    cloudflare_client: CloudflareClient = Depends(get_cloudflare_client),
    _: dict = Depends(get_current_user),
):
    return cloudflare_client.get_status()


@router.put("/cloudflare", response_model=CloudflareSettingsStatusResponse, summary="Cloudflare 설정 저장")
async def update_cloudflare_settings(
    request: CloudflareSettingsUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    repo = SQLiteSystemSettingsRepository(db)

    if not request.api_token:
        # 빈 토큰 = 설정 전체 초기화
        for key in ("cf_api_token", "cf_zone_id", "cf_record_target", "cf_proxied"):
            await repo.delete(key)
    else:
        await repo.set("cf_api_token", request.api_token)
        await repo.set("cf_zone_id", request.zone_id)
        await repo.set("cf_record_target", request.record_target or None)
        await repo.set("cf_proxied", "true" if request.proxied else "false")

    db_settings = await repo.get_all_dict()
    return CloudflareClient.from_db_settings(db_settings).get_status()


@router.get("/time-display", response_model=TimeDisplaySettingsResponse, summary="표시 시간대 설정 조회")
async def get_time_display_settings(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    repo = SQLiteSystemSettingsRepository(db)
    stored_timezone = await repo.get("display_timezone")
    return _build_time_display_response(stored_timezone)


@router.put("/time-display", response_model=TimeDisplaySettingsResponse, summary="표시 시간대 설정 저장")
async def update_time_display_settings(
    request: TimeDisplaySettingsUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    repo = SQLiteSystemSettingsRepository(db)
    await repo.set("display_timezone", request.display_timezone)
    return _build_time_display_response(request.display_timezone)


def _build_time_display_response(display_timezone: str | None) -> TimeDisplaySettingsResponse:
    normalized_timezone = normalize_display_timezone(display_timezone)
    server_context = get_server_time_context()
    return TimeDisplaySettingsResponse(
        display_timezone=normalized_timezone,
        display_timezone_name=get_display_timezone_name(normalized_timezone),
        display_timezone_label=get_display_timezone_label(normalized_timezone),
        storage_timezone=server_context["storage_timezone"],
        server_timezone_name=server_context["server_timezone_name"],
        server_timezone_label=server_context["server_timezone_label"],
        server_timezone_offset=server_context["server_timezone_offset"],
        server_time_iso=server_context["server_time_iso"],
    )
