import pytest

from app.interfaces.api.v1.routers.settings_audit_helpers import record_settings_update


class RecordingAuditService:
    def __init__(self):
        self.calls = []

    async def record(self, **kwargs):
        self.calls.append(kwargs)


@pytest.mark.asyncio
async def test_record_settings_update_records_changed_keys_and_rollback_payload():
    audit_service = RecordingAuditService()

    await record_settings_update(
        audit_service=audit_service,
        db=object(),
        actor="admin",
        event="settings_update_time_display",
        resource_name="시간 표시 설정",
        before={"display_timezone": "Asia/Seoul", "unchanged": True},
        after={"display_timezone": "UTC", "unchanged": True},
        rollback_payload={"display_timezone": "Asia/Seoul"},
        client_ip="203.0.113.10",
    )

    call = audit_service.calls[0]
    assert call["action"] == "update"
    assert call["resource_id"] == "settings_update_time_display"
    assert call["detail"]["changed_keys"] == ["display_timezone"]
    assert call["detail"]["rollback_supported"] is True
    assert call["detail"]["rollback_payload"] == {"display_timezone": "Asia/Seoul"}
    assert call["detail"]["client_ip"] == "203.0.113.10"
