from app.interfaces.api.v1.routers.settings_cloudflare_drift_summary import CloudflareDriftSummary
from app.interfaces.api.v1.schemas.settings_schemas import CloudflareDriftCheckResponse


def build_drift_response(summary: CloudflareDriftSummary) -> CloudflareDriftCheckResponse:
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
