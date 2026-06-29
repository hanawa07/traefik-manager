from app.infrastructure.cloudflare.client import CloudflareClient
from app.interfaces.api.v1.routers.settings_cloudflare_drift_orphans import collect_orphan_records
from app.interfaces.api.v1.routers.settings_cloudflare_drift_record_compare import collect_service_drift
from app.interfaces.api.v1.routers.settings_cloudflare_drift_summary import CloudflareDriftSummary
from app.interfaces.api.v1.schemas.settings_schemas import (
    CloudflareDriftRecordResponse,
    CloudflareDriftZoneResponse,
)


async def collect_drift_by_zone(
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
        records_by_name = group_records_by_name(all_records)
        current_domains = {str(service.domain) for service in zone_services}

        for service in zone_services:
            is_healthy = collect_service_drift(
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

        for issue in collect_orphan_records(all_records, current_domains):
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


def group_records_by_name(records: list[dict]) -> dict[str, list[dict]]:
    records_by_name: dict[str, list[dict]] = {}
    for record in records:
        record_name = record.get("name")
        if isinstance(record_name, str):
            records_by_name.setdefault(record_name, []).append(record)
    return records_by_name
