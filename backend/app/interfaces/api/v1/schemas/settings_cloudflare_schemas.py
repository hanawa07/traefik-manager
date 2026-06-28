from typing import Literal

from pydantic import BaseModel, Field, field_validator


class CloudflareSettingsStatusResponse(BaseModel):
    enabled: bool
    configured: bool
    zone_count: int = 0
    zones: list["CloudflareZoneStatusResponse"] = Field(default_factory=list)
    message: str


class CloudflareZoneStatusResponse(BaseModel):
    zone_id: str
    zone_name: str | None = None
    record_target: str | None = None
    proxied: bool


class CloudflareSettingsUpdateRequest(BaseModel):
    zones: list["CloudflareZoneUpdateRequest"] = Field(default_factory=list)

    @field_validator("zones")
    @classmethod
    def validate_zones(cls, value: list["CloudflareZoneUpdateRequest"]) -> list["CloudflareZoneUpdateRequest"]:
        non_empty_zones = [item for item in value if item.api_token or item.zone_id or item.record_target]
        for item in non_empty_zones:
            if not item.api_token or not item.zone_id:
                raise ValueError("각 Cloudflare 영역에는 API Token과 Zone ID가 필요합니다")
        return non_empty_zones


class CloudflareZoneUpdateRequest(BaseModel):
    api_token: str = ""
    zone_id: str = ""
    record_target: str = ""
    proxied: bool = False

    @field_validator("api_token", "zone_id", "record_target")
    @classmethod
    def normalize_cloudflare_zone_fields(cls, value: str) -> str:
        return value.strip()


class CloudflareDriftRecordResponse(BaseModel):
    domain: str
    issue: Literal["missing", "mismatch", "orphan"]
    detail: str
    expected_type: str | None = None
    expected_content: str | None = None
    expected_proxied: bool | None = None
    actual_type: str | None = None
    actual_content: str | None = None
    actual_proxied: bool | None = None
    record_id: str | None = None


class CloudflareDriftCheckResponse(BaseModel):
    success: bool
    message: str
    detail: str | None = None
    zone_count: int = 0
    total_services: int = 0
    eligible_services: int = 0
    skipped_services: int = 0
    healthy_services: int = 0
    zones: list["CloudflareDriftZoneResponse"] = Field(default_factory=list)
    excluded_services: list["CloudflareExcludedServiceResponse"] = Field(default_factory=list)
    missing_records: list[CloudflareDriftRecordResponse] = Field(default_factory=list)
    mismatched_records: list[CloudflareDriftRecordResponse] = Field(default_factory=list)
    orphan_records: list[CloudflareDriftRecordResponse] = Field(default_factory=list)


class CloudflareDriftZoneResponse(BaseModel):
    zone_name: str
    eligible_services: int = 0
    healthy_services: int = 0
    missing_records: list[CloudflareDriftRecordResponse] = Field(default_factory=list)
    mismatched_records: list[CloudflareDriftRecordResponse] = Field(default_factory=list)
    orphan_records: list[CloudflareDriftRecordResponse] = Field(default_factory=list)


class CloudflareExcludedServiceResponse(BaseModel):
    domain: str
    reason: str
