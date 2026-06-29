from app.interfaces.api.v1.schemas.settings_schemas import CloudflareDriftRecordResponse


def collect_orphan_records(records: list[dict], current_domains: set[str]) -> list[CloudflareDriftRecordResponse]:
    issues: list[CloudflareDriftRecordResponse] = []
    for record in records:
        record_name = record.get("name")
        if not isinstance(record_name, str):
            continue
        if record.get("comment") != "managed-by-traefik-manager":
            continue
        if record_name in current_domains:
            continue
        issues.append(
            CloudflareDriftRecordResponse(
                domain=record_name,
                issue="orphan",
                detail="현재 관리 대상 서비스와 연결되지 않은 manager 레코드입니다",
                actual_type=record.get("type") if isinstance(record.get("type"), str) else None,
                actual_content=record.get("content") if isinstance(record.get("content"), str) else None,
                actual_proxied=record.get("proxied") if isinstance(record.get("proxied"), bool) else None,
                record_id=record.get("id") if isinstance(record.get("id"), str) else None,
            )
        )
    return issues
