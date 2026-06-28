from datetime import datetime, timezone
from types import SimpleNamespace

from app.application.certificate import preflight_service


DEFAULT_DOMAIN = "example.com"
DEFAULT_RECOMMENDATION = "권한 DNS 응답을 먼저 확인하세요."
DEFAULT_ITEM_DETAIL = "권한 NS 응답이 타임아웃되었습니다."


class StubScalarResult:
    def __init__(self, items):
        self._items = items

    def all(self):
        return self._items


class StubExecuteResult:
    def __init__(self, items):
        self._items = items

    def scalars(self):
        return StubScalarResult(self._items)


class StubAuditDb:
    def __init__(self, logs):
        self._logs = logs

    async def execute(self, _query):
        return StubExecuteResult(self._logs)


def utc_dt(hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 3, 12, hour, minute, tzinfo=timezone.utc)


def capture_audit_records(monkeypatch):
    captured_records = []

    async def fake_record(**kwargs):
        captured_records.append(kwargs)

    monkeypatch.setattr(preflight_service.audit_service, "record", fake_record)
    return captured_records


def make_preflight_item(
    *,
    key: str = "dns_public",
    label: str = "공개 DNS 조회",
    status: str = "error",
    detail: str = DEFAULT_ITEM_DETAIL,
):
    return {
        "key": key,
        "label": label,
        "status": status,
        "detail": detail,
    }


def make_preflight_result(
    *,
    domain: str = DEFAULT_DOMAIN,
    checked_at: datetime | None = None,
    overall_status: str = "warning",
    recommendation: str = DEFAULT_RECOMMENDATION,
    item_status: str = "error",
    item_detail: str = DEFAULT_ITEM_DETAIL,
):
    return {
        "domain": domain,
        "checked_at": checked_at or utc_dt(12),
        "overall_status": overall_status,
        "recommendation": recommendation,
        "items": [
            make_preflight_item(
                status=item_status,
                detail=item_detail,
            )
        ],
    }


def make_preflight_log(
    *,
    checked_at: datetime,
    event: str = "certificate_preflight",
    overall_status: str = "warning",
    recommendation: str | None = DEFAULT_RECOMMENDATION,
    items: list[dict] | None = None,
    failure_keys: list[str] | None = None,
    resource_name: str | None = None,
):
    detail = {
        "event": event,
        "checked_at": checked_at.isoformat(),
        "overall_status": overall_status,
    }
    if recommendation is not None:
        detail["recommendation"] = recommendation
    if items is not None:
        detail["items"] = items
    elif event == "certificate_preflight":
        detail["items"] = [make_preflight_item()]
    if failure_keys is not None:
        detail["failure_keys"] = failure_keys

    attrs = {"detail": detail, "created_at": checked_at}
    if resource_name is not None:
        attrs["resource_name"] = resource_name
    return SimpleNamespace(**attrs)
