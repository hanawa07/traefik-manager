from dataclasses import dataclass, field

from app.infrastructure.cloudflare.client import CloudflareClient, CloudflareClientError
from app.interfaces.api.v1.schemas.settings_schemas import (
    CloudflareDriftCheckResponse,
    CloudflareDriftRecordResponse,
    CloudflareDriftZoneResponse,
    CloudflareExcludedServiceResponse,
)


@dataclass
class CloudflareDriftSummary:
    result: CloudflareDriftCheckResponse
    total_service_count: int = 0
    eligible_service_count: int = 0
    skipped_count: int = 0
    healthy_count: int = 0
    zone_count: int = 0
    missing_records: list[CloudflareDriftRecordResponse] = field(default_factory=list)
    mismatched_records: list[CloudflareDriftRecordResponse] = field(default_factory=list)
    orphan_records: list[CloudflareDriftRecordResponse] = field(default_factory=list)
    zone_results: list[CloudflareDriftZoneResponse] = field(default_factory=list)
    excluded_services: list[CloudflareExcludedServiceResponse] = field(default_factory=list)


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

        summary.eligible_service_count = sum(len(zone_services) for zone_services in services_by_zone.values())
        summary.skipped_count = len(summary.excluded_services)

        if not services:
            summary.result = CloudflareDriftCheckResponse(
                success=True,
                message="진단할 서비스가 없습니다",
                detail="등록된 서비스가 없어 Cloudflare DNS 드리프트를 검사하지 않았습니다",
                zone_count=summary.zone_count,
            )
        elif summary.eligible_service_count == 0:
            summary.result = CloudflareDriftCheckResponse(
                success=True,
                message="Cloudflare DNS 진단 대상이 없습니다",
                detail=f"현재 서비스 {summary.total_service_count}개가 모두 Cloudflare 관리 대상 zone 밖에 있습니다",
                zone_count=summary.zone_count,
                total_services=summary.total_service_count,
                skipped_services=summary.skipped_count,
                excluded_services=summary.excluded_services,
            )
        else:
            await _collect_drift_by_zone(cloudflare_client, services_by_zone, summary)
            summary.result = _build_drift_response(summary)
    except CloudflareClientError as exc:
        summary.result = CloudflareDriftCheckResponse(
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

    return summary


async def _collect_drift_by_zone(
    cloudflare_client: CloudflareClient,
    services_by_zone: dict[str, list],
    summary: CloudflareDriftSummary,
) -> None:
    for zone_config in cloudflare_client.zone_configs:
        zone_services = services_by_zone.get(zone_config.zone_id, [])
        zone_missing_records: list[CloudflareDriftRecordResponse] = []
        zone_mismatched_records: list[CloudflareDriftRecordResponse] = []
        zone_orphan_records: list[CloudflareDriftRecordResponse] = []
        zone_healthy_count = 0

        all_records = await cloudflare_client.list_records(zone_config)
        records_by_name: dict[str, list[dict]] = {}
        for record in all_records:
            record_name = record.get("name")
            if isinstance(record_name, str):
                records_by_name.setdefault(record_name, []).append(record)

        current_domains = {str(service.domain) for service in zone_services}

        for service in zone_services:
            is_healthy = _collect_service_drift(
                cloudflare_client=cloudflare_client,
                zone_config=zone_config,
                service=service,
                records_by_name=records_by_name,
                missing_records=summary.missing_records,
                mismatched_records=summary.mismatched_records,
                zone_missing_records=zone_missing_records,
                zone_mismatched_records=zone_mismatched_records,
            )
            if is_healthy:
                zone_healthy_count += 1
                summary.healthy_count += 1

        for record in all_records:
            record_name = record.get("name")
            if not isinstance(record_name, str):
                continue
            if record.get("comment") != "managed-by-traefik-manager":
                continue
            if record_name in current_domains:
                continue
            issue = CloudflareDriftRecordResponse(
                domain=record_name,
                issue="orphan",
                detail="현재 관리 대상 서비스와 연결되지 않은 manager 레코드입니다",
                actual_type=record.get("type") if isinstance(record.get("type"), str) else None,
                actual_content=record.get("content") if isinstance(record.get("content"), str) else None,
                actual_proxied=record.get("proxied") if isinstance(record.get("proxied"), bool) else None,
                record_id=record.get("id") if isinstance(record.get("id"), str) else None,
            )
            zone_orphan_records.append(issue)
            summary.orphan_records.append(issue)

        summary.zone_results.append(
            CloudflareDriftZoneResponse(
                zone_name=zone_config.zone_name or zone_config.zone_id,
                eligible_services=len(zone_services),
                healthy_services=zone_healthy_count,
                missing_records=zone_missing_records,
                mismatched_records=zone_mismatched_records,
                orphan_records=zone_orphan_records,
            )
        )


def _collect_service_drift(
    *,
    cloudflare_client: CloudflareClient,
    zone_config,
    service,
    records_by_name: dict[str, list[dict]],
    missing_records: list[CloudflareDriftRecordResponse],
    mismatched_records: list[CloudflareDriftRecordResponse],
    zone_missing_records: list[CloudflareDriftRecordResponse],
    zone_mismatched_records: list[CloudflareDriftRecordResponse],
) -> bool:
    domain = str(service.domain)
    expected_payload = cloudflare_client.build_service_record_payload(
        domain=domain,
        fallback_target=service.upstream.host,
        zone_config=zone_config,
    )
    expected_type = str(expected_payload["type"])
    expected_content = str(expected_payload["content"])
    expected_proxied = bool(expected_payload["proxied"])
    domain_records = records_by_name.get(domain, [])

    if not domain_records:
        issue = CloudflareDriftRecordResponse(
            domain=domain,
            issue="missing",
            detail="기대하는 DNS 레코드가 존재하지 않습니다",
            expected_type=expected_type,
            expected_content=expected_content,
            expected_proxied=expected_proxied,
        )
        zone_missing_records.append(issue)
        missing_records.append(issue)
        return False

    matching_record = next(
        (record for record in domain_records if record.get("type") == expected_type),
        None,
    )
    if matching_record is None:
        first_record = domain_records[0]
        issue = CloudflareDriftRecordResponse(
            domain=domain,
            issue="mismatch",
            detail=f"기대 타입 {expected_type} 레코드가 없고 현재 다른 타입 레코드가 존재합니다",
            expected_type=expected_type,
            expected_content=expected_content,
            expected_proxied=expected_proxied,
            actual_type=first_record.get("type") if isinstance(first_record.get("type"), str) else None,
            actual_content=first_record.get("content") if isinstance(first_record.get("content"), str) else None,
            actual_proxied=first_record.get("proxied") if isinstance(first_record.get("proxied"), bool) else None,
            record_id=first_record.get("id") if isinstance(first_record.get("id"), str) else None,
        )
        zone_mismatched_records.append(issue)
        mismatched_records.append(issue)
        return False

    actual_content = matching_record.get("content") if isinstance(matching_record.get("content"), str) else None
    actual_proxied = matching_record.get("proxied") if isinstance(matching_record.get("proxied"), bool) else None
    mismatch_reasons: list[str] = []
    if actual_content != expected_content:
        mismatch_reasons.append(f"content 현재값={actual_content or '-'} 기대값={expected_content}")
    if actual_proxied is not None and actual_proxied != expected_proxied:
        mismatch_reasons.append(
            f"proxied 현재값={'활성' if actual_proxied else '비활성'} 기대값={'활성' if expected_proxied else '비활성'}"
        )

    if not mismatch_reasons:
        return True

    issue = CloudflareDriftRecordResponse(
        domain=domain,
        issue="mismatch",
        detail=", ".join(mismatch_reasons),
        expected_type=expected_type,
        expected_content=expected_content,
        expected_proxied=expected_proxied,
        actual_type=matching_record.get("type") if isinstance(matching_record.get("type"), str) else None,
        actual_content=actual_content,
        actual_proxied=actual_proxied,
        record_id=matching_record.get("id") if isinstance(matching_record.get("id"), str) else None,
    )
    zone_mismatched_records.append(issue)
    mismatched_records.append(issue)
    return False


def _build_drift_response(summary: CloudflareDriftSummary) -> CloudflareDriftCheckResponse:
    if not summary.missing_records and not summary.mismatched_records and not summary.orphan_records:
        detail_parts = [f"Cloudflare 관리 대상 서비스 {summary.healthy_count}개가 목표 상태와 일치합니다"]
        if summary.skipped_count:
            detail_parts.append(f"비Cloudflare 도메인 {summary.skipped_count}개는 제외되었습니다")
        return CloudflareDriftCheckResponse(
            success=True,
            message="Cloudflare DNS 드리프트가 없습니다",
            detail=", ".join(detail_parts),
            zone_count=summary.zone_count,
            total_services=summary.total_service_count,
            eligible_services=summary.eligible_service_count,
            skipped_services=summary.skipped_count,
            healthy_services=summary.healthy_count,
            zones=summary.zone_results,
            excluded_services=summary.excluded_services,
        )

    detail_parts = [f"정상 {summary.healthy_count}개"]
    if summary.skipped_count:
        detail_parts.append(f"비Cloudflare 도메인 {summary.skipped_count}개 제외")
    return CloudflareDriftCheckResponse(
        success=False,
        message=(
            "Cloudflare DNS 드리프트가 감지되었습니다 "
            f"(누락 {len(summary.missing_records)}개, 불일치 {len(summary.mismatched_records)}개, 고아 {len(summary.orphan_records)}개)"
        ),
        detail=", ".join(detail_parts),
        zone_count=summary.zone_count,
        total_services=summary.total_service_count,
        eligible_services=summary.eligible_service_count,
        skipped_services=summary.skipped_count,
        healthy_services=summary.healthy_count,
        zones=summary.zone_results,
        excluded_services=summary.excluded_services,
        missing_records=summary.missing_records,
        mismatched_records=summary.mismatched_records,
        orphan_records=summary.orphan_records,
    )
