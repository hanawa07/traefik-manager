from app.infrastructure.cloudflare.client import CloudflareClient
from app.interfaces.api.v1.schemas.settings_schemas import CloudflareDriftRecordResponse


def collect_service_drift(
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
        issue = build_type_mismatch_record(
            domain=domain,
            expected_type=expected_type,
            expected_content=expected_content,
            expected_proxied=expected_proxied,
            actual_record=domain_records[0],
        )
        zone_mismatched_records.append(issue)
        mismatched_records.append(issue)
        return False

    mismatch_reasons = build_mismatch_reasons(
        matching_record=matching_record,
        expected_content=expected_content,
        expected_proxied=expected_proxied,
    )
    if not mismatch_reasons:
        return True

    issue = build_value_mismatch_record(
        domain=domain,
        expected_type=expected_type,
        expected_content=expected_content,
        expected_proxied=expected_proxied,
        actual_record=matching_record,
        mismatch_reasons=mismatch_reasons,
    )
    zone_mismatched_records.append(issue)
    mismatched_records.append(issue)
    return False


def build_type_mismatch_record(
    *,
    domain: str,
    expected_type: str,
    expected_content: str,
    expected_proxied: bool,
    actual_record: dict,
) -> CloudflareDriftRecordResponse:
    return CloudflareDriftRecordResponse(
        domain=domain,
        issue="mismatch",
        detail=f"기대 타입 {expected_type} 레코드가 없고 현재 다른 타입 레코드가 존재합니다",
        expected_type=expected_type,
        expected_content=expected_content,
        expected_proxied=expected_proxied,
        actual_type=actual_record.get("type") if isinstance(actual_record.get("type"), str) else None,
        actual_content=actual_record.get("content") if isinstance(actual_record.get("content"), str) else None,
        actual_proxied=actual_record.get("proxied") if isinstance(actual_record.get("proxied"), bool) else None,
        record_id=actual_record.get("id") if isinstance(actual_record.get("id"), str) else None,
    )


def build_mismatch_reasons(
    *,
    matching_record: dict,
    expected_content: str,
    expected_proxied: bool,
) -> list[str]:
    actual_content = matching_record.get("content") if isinstance(matching_record.get("content"), str) else None
    actual_proxied = matching_record.get("proxied") if isinstance(matching_record.get("proxied"), bool) else None
    mismatch_reasons: list[str] = []
    if actual_content != expected_content:
        mismatch_reasons.append(f"content 현재값={actual_content or '-'} 기대값={expected_content}")
    if actual_proxied is not None and actual_proxied != expected_proxied:
        mismatch_reasons.append(
            f"proxied 현재값={'활성' if actual_proxied else '비활성'} 기대값={'활성' if expected_proxied else '비활성'}"
        )
    return mismatch_reasons


def build_value_mismatch_record(
    *,
    domain: str,
    expected_type: str,
    expected_content: str,
    expected_proxied: bool,
    actual_record: dict,
    mismatch_reasons: list[str],
) -> CloudflareDriftRecordResponse:
    actual_content = actual_record.get("content") if isinstance(actual_record.get("content"), str) else None
    actual_proxied = actual_record.get("proxied") if isinstance(actual_record.get("proxied"), bool) else None
    return CloudflareDriftRecordResponse(
        domain=domain,
        issue="mismatch",
        detail=", ".join(mismatch_reasons),
        expected_type=expected_type,
        expected_content=expected_content,
        expected_proxied=expected_proxied,
        actual_type=actual_record.get("type") if isinstance(actual_record.get("type"), str) else None,
        actual_content=actual_content,
        actual_proxied=actual_proxied,
        record_id=actual_record.get("id") if isinstance(actual_record.get("id"), str) else None,
    )
