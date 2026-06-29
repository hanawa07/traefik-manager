from app.interfaces.api.v1.routers.settings_cloudflare_drift_response import build_drift_response
from app.interfaces.api.v1.routers.settings_cloudflare_drift_summary import CloudflareDriftSummary
from app.interfaces.api.v1.schemas.settings_schemas import (
    CloudflareDriftCheckResponse,
    CloudflareDriftRecordResponse,
)


def make_summary() -> CloudflareDriftSummary:
    return CloudflareDriftSummary(
        result=CloudflareDriftCheckResponse(
            success=False,
            message="initial",
        ),
        total_service_count=3,
        eligible_service_count=2,
        skipped_count=1,
        healthy_count=2,
        zone_count=1,
    )


def test_build_drift_response_returns_success_when_no_issues():
    response = build_drift_response(make_summary())

    assert response.success is True
    assert response.message == "Cloudflare DNS 드리프트가 없습니다"
    assert response.detail == "Cloudflare 관리 대상 서비스 2개가 목표 상태와 일치합니다, 비Cloudflare 도메인 1개는 제외되었습니다"
    assert response.total_services == 3
    assert response.eligible_services == 2


def test_build_drift_response_returns_issue_counts():
    summary = make_summary()
    summary.missing_records.append(
        CloudflareDriftRecordResponse(
            domain="missing.example.com",
            issue="missing",
            detail="missing",
        )
    )

    response = build_drift_response(summary)

    assert response.success is False
    assert response.message == "Cloudflare DNS 드리프트가 감지되었습니다 (누락 1개, 불일치 0개, 고아 0개)"
    assert response.detail == "정상 2개, 비Cloudflare 도메인 1개 제외"
    assert [item.domain for item in response.missing_records] == ["missing.example.com"]
