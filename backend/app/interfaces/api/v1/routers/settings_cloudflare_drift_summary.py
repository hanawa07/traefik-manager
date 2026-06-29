from dataclasses import dataclass, field

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
