from fastapi import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.certificate.preflight_service import (
    get_certificate_preflight_state as load_certificate_preflight_state,
    record_certificate_preflight_result,
)
from app.core.certificate_diagnostics import build_certificate_diagnostics_settings
from app.infrastructure.certificates.certificate_alert_monitor import (
    check_certificate_alerts_once,
    get_certificate_alert_state,
)
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import (
    SQLiteSystemSettingsRepository,
)
from app.infrastructure.traefik.traefik_api_client import TraefikApiClient
from app.interfaces.api.dependencies import get_current_user
from app.interfaces.api.v1.routers.certificates_check_routes import (
    register_certificate_check_routes,
)
from app.interfaces.api.v1.routers.certificates_metadata import (
    apply_alert_metadata as _apply_alert_metadata,
    apply_preflight_metadata as _apply_preflight_metadata,
    parse_iso_datetime as _parse_iso_datetime,
)
from app.interfaces.api.v1.routers.certificates_preflight_routes import (
    register_certificate_preflight_routes,
)
from app.interfaces.api.v1.routers.certificates_read_routes import register_certificate_read_routes
from app.interfaces.api.v1.schemas.certificate_schemas import (
    CertificateCheckResponse,
    CertificatePreflightResponse,
    CertificateResponse,
)

router = APIRouter()


def get_traefik_client() -> TraefikApiClient:
    return TraefikApiClient()


async def _get_certificate_alert_state(db: AsyncSession) -> dict[str, dict]:
    return await get_certificate_alert_state(db)


async def _get_certificate_preflight_state(db: AsyncSession) -> dict[str, dict]:
    diagnostics_settings = await _load_certificate_diagnostics_settings(db)
    return await load_certificate_preflight_state(db, config=diagnostics_settings)


async def _load_certificate_diagnostics_settings(db: AsyncSession):
    repo = SQLiteSystemSettingsRepository(db)
    try:
        return build_certificate_diagnostics_settings(await repo.get_all_dict())
    except Exception:
        return build_certificate_diagnostics_settings()


_read_endpoints = register_certificate_read_routes(
    router,
    get_traefik_client=get_traefik_client,
    current_user_dependency=get_current_user,
    alert_state_provider=lambda: _get_certificate_alert_state,
    preflight_state_provider=lambda: _get_certificate_preflight_state,
    apply_alert_metadata_func=_apply_alert_metadata,
    apply_preflight_metadata_func=_apply_preflight_metadata,
)
list_certificates = _read_endpoints.list_certificates

_check_endpoints = register_certificate_check_routes(
    router,
    get_traefik_client=get_traefik_client,
    current_user_dependency=get_current_user,
    check_alerts_once_provider=lambda: check_certificate_alerts_once,
)
check_certificates = _check_endpoints.check_certificates

_preflight_endpoints = register_certificate_preflight_routes(
    router,
    get_traefik_client=get_traefik_client,
    current_user_dependency=get_current_user,
    record_preflight_result_provider=lambda: record_certificate_preflight_result,
    diagnostics_settings_provider=lambda: _load_certificate_diagnostics_settings,
)
preflight_certificate = _preflight_endpoints.preflight_certificate

__all__ = [
    "CertificateCheckResponse",
    "CertificatePreflightResponse",
    "CertificateResponse",
    "check_certificates",
    "get_traefik_client",
    "list_certificates",
    "preflight_certificate",
    "router",
    "_parse_iso_datetime",
]
