from dataclasses import dataclass
from datetime import datetime, timezone

from app.infrastructure.notifications.security_alert_delivery_log import get_event
from app.infrastructure.persistence.models import AuditLogModel


@dataclass(frozen=True)
class RetryDeliveryContext:
    provider: str
    source_event: str
    category: str
    source_log: AuditLogModel


def build_retry_delivery_context(delivery_log: AuditLogModel) -> RetryDeliveryContext:
    detail = delivery_log.detail or {}
    delivery_event = get_event(delivery_log)
    if delivery_event not in {"security_alert_delivery_failure", "change_alert_delivery_failure"}:
        raise ValueError("재시도할 수 없는 알림 전송 로그입니다")

    provider = detail.get("provider")
    source_event = detail.get("source_event")
    source_action = detail.get("source_action")
    source_resource_type = detail.get("source_resource_type")
    source_resource_id = detail.get("source_resource_id")
    source_resource_name = detail.get("source_resource_name")
    if not all(
        isinstance(value, str) and value
        for value in (provider, source_event, source_action, source_resource_type, source_resource_id, source_resource_name)
    ):
        raise ValueError("재시도에 필요한 원본 알림 정보가 부족합니다")

    source_log = AuditLogModel(
        actor="system",
        action=source_action,
        resource_type=source_resource_type,
        resource_id=source_resource_id,
        resource_name=source_resource_name,
        detail={
            "event": source_event,
            "client_ip": detail.get("client_ip"),
        },
    )
    source_log.created_at = datetime.now(timezone.utc)
    return RetryDeliveryContext(
        provider=provider,
        source_event=source_event,
        category="security" if delivery_event.startswith("security_") else "change",
        source_log=source_log,
    )
