from datetime import datetime, timezone

from app.interfaces.api.v1.routers.audit_delivery_retry_chain import build_delivery_retry_chain
from tests.interfaces.api.audit_router_fakes import make_log


def test_retry_chain_includes_ancestors_descendants_and_ignores_unrelated_logs():
    root = make_log(
        action="alert",
        resource_type="settings",
        event="security_alert_delivery_failure",
        created_at=datetime(2026, 7, 18, 1, 0),
    )
    first_retry = make_log(
        action="alert",
        resource_type="settings",
        event="security_alert_delivery_failure",
        detail_extra={"retry_of_audit_id": str(root.id)},
        created_at=datetime(2026, 7, 18, 2, 0, tzinfo=timezone.utc),
    )
    second_retry = make_log(
        action="alert",
        resource_type="settings",
        event="security_alert_delivery_success",
        detail_extra={"retry_of_audit_id": str(first_retry.id)},
        created_at=datetime(2026, 7, 18, 3, 0, tzinfo=timezone.utc),
    )
    unrelated = make_log(
        action="alert",
        resource_type="settings",
        event="change_alert_delivery_failure",
        created_at=datetime(2026, 7, 18, 4, 0, tzinfo=timezone.utc),
    )

    chain = build_delivery_retry_chain(
        [second_retry, unrelated, root, first_retry],
        str(first_retry.id),
    )

    assert [log.id for log in chain] == [root.id, first_retry.id, second_retry.id]
