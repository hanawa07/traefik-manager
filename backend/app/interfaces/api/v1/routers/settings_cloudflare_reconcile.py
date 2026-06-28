from dataclasses import dataclass

from app.infrastructure.cloudflare.client import CloudflareClient, CloudflareClientError
from app.interfaces.api.v1.schemas.settings_schemas import SettingsTestActionResponse


@dataclass
class CloudflareReconcileSummary:
    result: SettingsTestActionResponse
    total_service_count: int = 0
    eligible_service_count: int = 0
    skipped_count: int = 0
    synced_count: int = 0
    failed_count: int = 0
    cleaned_count: int = 0
    cleanup_failed_count: int = 0
    zone_count: int = 0


async def reconcile_cloudflare_dns_records(
    *,
    cloudflare_client: CloudflareClient,
    service_repository,
) -> CloudflareReconcileSummary:
    summary = CloudflareReconcileSummary(
        result=SettingsTestActionResponse(
            success=False,
            message="Cloudflare DNS 재동기화에 실패했습니다",
            detail="Cloudflare 영역 설정을 먼저 저장해야 합니다",
            provider=None,
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
                summary.skipped_count += 1
                continue
            services_by_zone.setdefault(matched_zone.zone_id, []).append(service)

        summary.eligible_service_count = sum(len(zone_services) for zone_services in services_by_zone.values())
        failure_messages: list[str] = []

        for zone_config in cloudflare_client.zone_configs:
            zone_services = services_by_zone.get(zone_config.zone_id, [])
            current_domains = {str(service.domain) for service in zone_services}

            for service in zone_services:
                try:
                    record_id = await cloudflare_client.upsert_service_record(
                        domain=str(service.domain),
                        fallback_target=service.upstream.host,
                    )
                    if record_id != service.cloudflare_record_id:
                        service.cloudflare_record_id = record_id
                        await service_repository.save(service)
                    summary.synced_count += 1
                except Exception as exc:
                    summary.failed_count += 1
                    failure_messages.append(f"{service.domain}: {exc}")

            if not zone_services:
                continue

            try:
                managed_records = await cloudflare_client.list_managed_records(zone_config)
            except Exception as exc:
                summary.cleanup_failed_count += 1
                failure_messages.append(f"{zone_config.zone_name or zone_config.zone_id} 관리 레코드 조회 실패: {exc}")
                continue

            orphan_records = [
                record
                for record in managed_records
                if isinstance(record.get("name"), str) and record["name"] not in current_domains
            ]
            for record in orphan_records:
                domain = record.get("name")
                record_id = record.get("id")
                if not isinstance(domain, str):
                    continue
                try:
                    await cloudflare_client.delete_service_record(domain=domain, record_id=record_id)
                    summary.cleaned_count += 1
                except Exception as exc:
                    summary.cleanup_failed_count += 1
                    failure_messages.append(f"{domain} 정리 실패: {exc}")

        summary.result = _build_reconcile_response(summary, failure_messages)
    except CloudflareClientError as exc:
        summary.result = SettingsTestActionResponse(
            success=False,
            message="Cloudflare DNS 재동기화에 실패했습니다",
            detail=str(exc),
            provider=None,
        )
    return summary


def _build_reconcile_response(
    summary: CloudflareReconcileSummary,
    failure_messages: list[str],
) -> SettingsTestActionResponse:
    if summary.total_service_count == 0:
        return SettingsTestActionResponse(
            success=True,
            message="재동기화할 서비스가 없습니다",
            detail="등록된 서비스가 없어 Cloudflare DNS 재동기화를 수행하지 않았습니다",
            provider=None,
        )
    if summary.eligible_service_count == 0:
        return SettingsTestActionResponse(
            success=True,
            message="Cloudflare DNS 재동기화 대상이 없습니다",
            detail=f"현재 서비스 {summary.total_service_count}개가 모두 Cloudflare 관리 대상 zone 밖에 있습니다",
            provider=None,
        )
    if summary.failed_count == 0 and summary.cleanup_failed_count == 0:
        detail_parts = [f"Cloudflare 관리 대상 서비스 {summary.synced_count}개를 동기화했습니다"]
        if summary.cleaned_count:
            detail_parts.append(f"고아 레코드 {summary.cleaned_count}개를 정리했습니다")
        if summary.skipped_count:
            detail_parts.append(f"비Cloudflare 도메인 {summary.skipped_count}개는 제외했습니다")
        return SettingsTestActionResponse(
            success=True,
            message="Cloudflare DNS 재동기화가 완료되었습니다",
            detail=", ".join(detail_parts),
            provider=None,
        )

    failure_preview = " / ".join(failure_messages[:3])
    if len(failure_messages) > 3:
        failure_preview += f" 외 {len(failure_messages) - 3}건"
    skipped_detail = f", 비Cloudflare 도메인 {summary.skipped_count}개 제외" if summary.skipped_count else ""
    cleanup_detail = f", 고아 레코드 정리 실패 {summary.cleanup_failed_count}개" if summary.cleanup_failed_count else ""
    return SettingsTestActionResponse(
        success=False,
        message=(
            "Cloudflare DNS 재동기화 중 일부 실패가 발생했습니다 "
            f"(성공 {summary.synced_count}개, 실패 {summary.failed_count}개{cleanup_detail}{skipped_detail})"
        ),
        detail=failure_preview,
        provider=None,
    )
