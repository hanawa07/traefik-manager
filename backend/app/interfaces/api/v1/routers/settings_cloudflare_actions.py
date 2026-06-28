from collections.abc import Callable

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.cloudflare.client import CloudflareClient
from app.interfaces.api.v1.routers.settings_audit_helpers import (
    record_cloudflare_connection_test_audit,
    record_cloudflare_drift_audit,
    record_cloudflare_reconcile_audit,
)
from app.interfaces.api.v1.routers.settings_cloudflare_drift import diagnose_cloudflare_dns_drift_records
from app.interfaces.api.v1.routers.settings_cloudflare_reconcile import reconcile_cloudflare_dns_records
from app.interfaces.api.v1.schemas.settings_schemas import (
    CloudflareDriftCheckResponse,
    SettingsTestActionResponse,
)

ServiceRepositoryFactory = Callable[[AsyncSession], object]
ClientIpGetter = Callable[[Request], str]


async def test_cloudflare_connection_action(
    *,
    request: Request,
    db: AsyncSession,
    actor: dict,
    cloudflare_client: CloudflareClient,
    audit_service,
    client_ip_getter: ClientIpGetter,
) -> SettingsTestActionResponse:
    result = SettingsTestActionResponse(**(await cloudflare_client.test_connection()))
    await record_cloudflare_connection_test_audit(
        audit_service=audit_service,
        db=db,
        actor=actor.get("username", "unknown"),
        result=result,
        client_ip=client_ip_getter(request),
    )
    return result


async def diagnose_cloudflare_dns_drift_action(
    *,
    request: Request,
    db: AsyncSession,
    actor: dict,
    cloudflare_client: CloudflareClient,
    service_repository_factory: ServiceRepositoryFactory,
    audit_service,
    client_ip_getter: ClientIpGetter,
) -> CloudflareDriftCheckResponse:
    summary = await diagnose_cloudflare_dns_drift_records(
        cloudflare_client=cloudflare_client,
        service_repository=service_repository_factory(db),
    )
    await record_cloudflare_drift_audit(
        audit_service=audit_service,
        db=db,
        actor=actor.get("username", "unknown"),
        summary=summary,
        client_ip=client_ip_getter(request),
    )
    return summary.result


async def reconcile_cloudflare_dns_action(
    *,
    request: Request,
    db: AsyncSession,
    actor: dict,
    cloudflare_client: CloudflareClient,
    service_repository_factory: ServiceRepositoryFactory,
    audit_service,
    client_ip_getter: ClientIpGetter,
) -> SettingsTestActionResponse:
    summary = await reconcile_cloudflare_dns_records(
        cloudflare_client=cloudflare_client,
        service_repository=service_repository_factory(db),
    )
    await record_cloudflare_reconcile_audit(
        audit_service=audit_service,
        db=db,
        actor=actor.get("username", "unknown"),
        summary=summary,
        client_ip=client_ip_getter(request),
    )
    return summary.result
