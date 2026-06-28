import logging

from app.domain.proxy.entities.service import Service
from app.infrastructure.cloudflare.client import CloudflareClient

logger = logging.getLogger(__name__)


async def sync_cloudflare_record(
    cloudflare_client: CloudflareClient,
    service: Service,
    *,
    require_enabled: bool = False,
    include_service_id: bool = False,
) -> None:
    if require_enabled and not cloudflare_client.enabled:
        return

    try:
        service.cloudflare_record_id = await cloudflare_client.upsert_service_record(
            domain=str(service.domain),
            fallback_target=service.upstream_host,
        )
    except Exception:
        logger.warning(
            "Cloudflare DNS 연동 실패",
            extra=_log_extra(service, include_service_id=include_service_id),
        )
        raise


async def delete_cloudflare_record(
    cloudflare_client: CloudflareClient,
    service: Service,
) -> None:
    try:
        await cloudflare_client.delete_service_record(
            domain=str(service.domain),
            record_id=service.cloudflare_record_id,
        )
    except Exception:
        logger.warning(
            "Cloudflare DNS 삭제 실패",
            extra=_log_extra(
                service,
                include_service_id=True,
                include_record_id=True,
            ),
        )
        raise


async def rollback_cloudflare_record(
    cloudflare_client: CloudflareClient,
    service: Service,
) -> None:
    if not service.cloudflare_record_id:
        return

    try:
        await cloudflare_client.delete_service_record(
            domain=str(service.domain),
            record_id=service.cloudflare_record_id,
        )
    except Exception:
        logger.warning(
            "Cloudflare DNS 롤백 실패",
            extra=_log_extra(service, include_record_id=True),
        )


def _log_extra(
    service: Service,
    *,
    include_service_id: bool = False,
    include_record_id: bool = False,
) -> dict[str, str | None]:
    extra = {
        "service_name": service.name,
        "domain": str(service.domain),
    }
    if include_service_id:
        extra["service_id"] = str(service.id)
    if include_record_id:
        extra["cloudflare_record_id"] = service.cloudflare_record_id
    return extra
