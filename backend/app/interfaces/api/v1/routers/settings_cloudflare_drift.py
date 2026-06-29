from app.infrastructure.cloudflare.client import CloudflareClient, CloudflareClientError
from app.interfaces.api.v1.routers.settings_cloudflare_drift_collector import collect_drift_by_zone
from app.interfaces.api.v1.routers.settings_cloudflare_drift_response import build_drift_response
from app.interfaces.api.v1.routers.settings_cloudflare_drift_summary import CloudflareDriftSummary
from app.interfaces.api.v1.schemas.settings_schemas import (
    CloudflareDriftCheckResponse,
    CloudflareExcludedServiceResponse,
)


async def diagnose_cloudflare_dns_drift_records(
    *,
    cloudflare_client: CloudflareClient,
    service_repository,
) -> CloudflareDriftSummary:
    summary = CloudflareDriftSummary(
        result=CloudflareDriftCheckResponse(
            success=False,
            message="Cloudflare DNS 드리프트 진단에 실패했습니다",
            detail="Cloudflare 영역 설정을 먼저 저장해야 합니다",
        )
    )
    if not cloudflare_client.enabled:
        return summary

    try:
        await cloudflare_client.ensure_zone_names()
        summary.zone_count = len(cloudflare_client.zone_configs)
        if summary.zone_count == 0:
            raise CloudflareClientError("Zone 이름을 확인할 수 없습니다")

        services = await service_repository.find_all()
        summary.total_service_count = len(services)

        services_by_zone = await group_services_by_zone(
            cloudflare_client=cloudflare_client,
            services=services,
            summary=summary,
        )
        summary.eligible_service_count = sum(len(zone_services) for zone_services in services_by_zone.values())
        summary.skipped_count = len(summary.excluded_services)

        if not services:
            summary.result = build_empty_services_response(summary)
        elif summary.eligible_service_count == 0:
            summary.result = build_no_eligible_services_response(summary)
        else:
            await collect_drift_by_zone(cloudflare_client, services_by_zone, summary)
            summary.result = build_drift_response(summary)
    except CloudflareClientError as exc:
        summary.result = build_failure_response(summary, exc)

    return summary


async def group_services_by_zone(
    *,
    cloudflare_client: CloudflareClient,
    services: list,
    summary: CloudflareDriftSummary,
) -> dict[str, list]:
    services_by_zone: dict[str, list] = {config.zone_id: [] for config in cloudflare_client.zone_configs}
    for service in services:
        matched_zone = await cloudflare_client.get_matching_zone(str(service.domain))
        if matched_zone is None:
            summary.excluded_services.append(
                CloudflareExcludedServiceResponse(
                    domain=str(service.domain),
                    reason="Cloudflare 관리 대상 zone이 아니므로 진단에서 제외됩니다",
                )
            )
            continue
        services_by_zone.setdefault(matched_zone.zone_id, []).append(service)
    return services_by_zone


def build_empty_services_response(summary: CloudflareDriftSummary) -> CloudflareDriftCheckResponse:
    return CloudflareDriftCheckResponse(
        success=True,
        message="진단할 서비스가 없습니다",
        detail="등록된 서비스가 없어 Cloudflare DNS 드리프트를 검사하지 않았습니다",
        zone_count=summary.zone_count,
    )


def build_no_eligible_services_response(summary: CloudflareDriftSummary) -> CloudflareDriftCheckResponse:
    return CloudflareDriftCheckResponse(
        success=True,
        message="Cloudflare DNS 진단 대상이 없습니다",
        detail=f"현재 서비스 {summary.total_service_count}개가 모두 Cloudflare 관리 대상 zone 밖에 있습니다",
        zone_count=summary.zone_count,
        total_services=summary.total_service_count,
        skipped_services=summary.skipped_count,
        excluded_services=summary.excluded_services,
    )


def build_failure_response(
    summary: CloudflareDriftSummary,
    exc: CloudflareClientError,
) -> CloudflareDriftCheckResponse:
    return CloudflareDriftCheckResponse(
        success=False,
        message="Cloudflare DNS 드리프트 진단에 실패했습니다",
        detail=str(exc),
        zone_count=summary.zone_count,
        total_services=summary.total_service_count,
        eligible_services=summary.eligible_service_count,
        skipped_services=summary.skipped_count,
        healthy_services=summary.healthy_count,
        zones=summary.zone_results,
        excluded_services=summary.excluded_services,
    )
