from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.audit import audit_service
from app.core.logging_config import get_client_ip
from app.infrastructure.cloudflare.client import CF_ZONE_CONFIGS_KEY, CloudflareClient, CloudflareClientError
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.repositories.sqlite_service_repository import SQLiteServiceRepository
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import SQLiteSystemSettingsRepository
from app.interfaces.api.dependencies import get_current_user, require_admin
from app.interfaces.api.v1.routers.settings_cloudflare_actions import (
    diagnose_cloudflare_dns_drift_action as _diagnose_cloudflare_dns_drift_action,
    reconcile_cloudflare_dns_action as _reconcile_cloudflare_dns_action,
    test_cloudflare_connection_action as _test_cloudflare_connection_action,
    update_cloudflare_settings_action as _update_cloudflare_settings_action,
)
from app.interfaces.api.v1.routers.settings_cloudflare_client import get_cloudflare_client
from app.interfaces.api.v1.schemas.settings_schemas import (
    CloudflareDriftCheckResponse,
    CloudflareSettingsStatusResponse,
    CloudflareSettingsUpdateRequest,
    SettingsTestActionResponse,
)

router = APIRouter()


async def _update_settings(action, request, http_request, db: AsyncSession, actor: dict):
    return await action(
        request=request,
        http_request=http_request,
        db=db,
        actor=actor,
        settings_repository_factory=SQLiteSystemSettingsRepository,
        audit_service=audit_service,
        client_ip_getter=_maybe_get_client_ip,
    )


@router.get("/cloudflare", response_model=CloudflareSettingsStatusResponse, summary="Cloudflare 설정 상태")
async def get_cloudflare_status(
    cloudflare_client: CloudflareClient = Depends(get_cloudflare_client),
    _: dict = Depends(get_current_user),
):
    return cloudflare_client.get_status()


@router.post("/cloudflare/test", response_model=SettingsTestActionResponse, summary="Cloudflare 연결 테스트")
async def test_cloudflare_connection(
    request: Request,
    db: AsyncSession = Depends(get_db),
    cloudflare_client: CloudflareClient = Depends(get_cloudflare_client),
    _: dict = Depends(require_admin),
):
    return await _test_cloudflare_connection_action(
        request=request,
        db=db,
        actor=_,
        cloudflare_client=cloudflare_client,
        audit_service=audit_service,
        client_ip_getter=get_client_ip,
    )


@router.post("/cloudflare/drift", response_model=CloudflareDriftCheckResponse, summary="Cloudflare DNS 드리프트 진단")
async def diagnose_cloudflare_dns_drift(
    request: Request,
    db: AsyncSession = Depends(get_db),
    cloudflare_client: CloudflareClient = Depends(get_cloudflare_client),
    _: dict = Depends(require_admin),
):
    return await _diagnose_cloudflare_dns_drift_action(
        request=request,
        db=db,
        actor=_,
        cloudflare_client=cloudflare_client,
        service_repository_factory=SQLiteServiceRepository,
        audit_service=audit_service,
        client_ip_getter=get_client_ip,
    )


@router.post("/cloudflare/reconcile", response_model=SettingsTestActionResponse, summary="Cloudflare DNS 재동기화")
async def reconcile_cloudflare_dns(
    request: Request,
    db: AsyncSession = Depends(get_db),
    cloudflare_client: CloudflareClient = Depends(get_cloudflare_client),
    _: dict = Depends(require_admin),
):
    return await _reconcile_cloudflare_dns_action(
        request=request,
        db=db,
        actor=_,
        cloudflare_client=cloudflare_client,
        service_repository_factory=SQLiteServiceRepository,
        audit_service=audit_service,
        client_ip_getter=get_client_ip,
    )


@router.put("/cloudflare", response_model=CloudflareSettingsStatusResponse, summary="Cloudflare 설정 저장")
async def update_cloudflare_settings(
    request: CloudflareSettingsUpdateRequest,
    http_request: Request = None,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    return await _update_settings(_update_cloudflare_settings_action, request, http_request, db, _)


def _maybe_get_client_ip(http_request: Request | None) -> str | None:
    if http_request is None:
        return None
    return get_client_ip(http_request)
