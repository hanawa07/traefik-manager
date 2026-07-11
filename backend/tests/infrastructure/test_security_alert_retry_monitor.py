from types import SimpleNamespace
from uuid import uuid4

from app.infrastructure.notifications.security_alert_retry_monitor import (
    select_auto_retry_candidates,
)


def make_delivery(event: str, **detail):
    return SimpleNamespace(
        id=uuid4(),
        action="alert",
        resource_type="settings",
        resource_id="security-alert-delivery",
        resource_name="보안 알림 전송 결과",
        detail={
            "event": event,
            "provider": "telegram",
            "source_event": "login_suspicious",
            "source_action": "login_failed",
            "source_resource_type": "auth",
            "source_resource_id": "user",
            "source_resource_name": "사용자",
            **detail,
        },
    )


def test_select_auto_retry_candidates_uses_only_unretried_leaf() -> None:
    original = make_delivery("security_alert_delivery_failure")
    retry_failure = make_delivery(
        "security_alert_delivery_failure",
        retry_of_audit_id=str(original.id),
        auto_retry_attempt=1,
        retry_root_audit_id=str(original.id),
    )
    completed = make_delivery(
        "security_alert_delivery_success",
        retry_of_audit_id=str(uuid4()),
    )

    candidates = select_auto_retry_candidates([retry_failure, completed, original])

    assert candidates == [retry_failure]


def test_select_auto_retry_candidates_stops_after_three_attempts() -> None:
    exhausted = make_delivery(
        "change_alert_delivery_failure",
        auto_retry_attempt=3,
    )

    assert select_auto_retry_candidates([exhausted]) == []


def test_select_auto_retry_candidates_skips_incomplete_legacy_log() -> None:
    incomplete = make_delivery("security_alert_delivery_failure", source_event=None)

    assert select_auto_retry_candidates([incomplete]) == []
