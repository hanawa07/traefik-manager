from types import SimpleNamespace

from app.interfaces.api.v1.routers.settings_cloudflare_drift_orphans import collect_orphan_records
from app.interfaces.api.v1.routers.settings_cloudflare_drift_record_compare import (
    build_mismatch_reasons,
    collect_service_drift,
)


class PayloadCloudflareClient:
    def build_service_record_payload(self, domain: str, fallback_target: str, zone_config=None):
        return {
            "type": "A",
            "name": domain,
            "content": fallback_target,
            "ttl": 1,
            "proxied": bool(getattr(zone_config, "proxied", False)),
            "comment": "managed-by-traefik-manager",
        }


def test_collect_service_drift_reports_missing_record():
    missing_records = []
    mismatched_records = []

    result = collect_service_drift(
        cloudflare_client=PayloadCloudflareClient(),
        zone_config=SimpleNamespace(proxied=True),
        service=SimpleNamespace(domain="missing.example.com", upstream=SimpleNamespace(host="220.117.211.140")),
        records_by_name={},
        missing_records=missing_records,
        mismatched_records=mismatched_records,
        zone_missing_records=[],
        zone_mismatched_records=[],
    )

    assert result is False
    assert missing_records[0].domain == "missing.example.com"
    assert missing_records[0].expected_content == "220.117.211.140"
    assert mismatched_records == []


def test_build_mismatch_reasons_includes_content_and_proxy_changes():
    reasons = build_mismatch_reasons(
        matching_record={"content": "203.0.113.55", "proxied": False},
        expected_content="220.117.211.140",
        expected_proxied=True,
    )

    assert reasons == [
        "content 현재값=203.0.113.55 기대값=220.117.211.140",
        "proxied 현재값=비활성 기대값=활성",
    ]


def test_collect_orphan_records_skips_current_domains_and_unmanaged_records():
    records = [
        {
            "id": "record-current",
            "name": "app.example.com",
            "type": "A",
            "content": "220.117.211.140",
            "proxied": True,
            "comment": "managed-by-traefik-manager",
        },
        {
            "id": "record-unmanaged",
            "name": "manual.example.com",
            "type": "A",
            "content": "220.117.211.140",
            "proxied": True,
            "comment": "manual",
        },
        {
            "id": "record-orphan",
            "name": "old.example.com",
            "type": "A",
            "content": "220.117.211.140",
            "proxied": False,
            "comment": "managed-by-traefik-manager",
        },
    ]

    issues = collect_orphan_records(records, {"app.example.com"})

    assert [issue.domain for issue in issues] == ["old.example.com"]
    assert issues[0].record_id == "record-orphan"
    assert issues[0].actual_proxied is False
