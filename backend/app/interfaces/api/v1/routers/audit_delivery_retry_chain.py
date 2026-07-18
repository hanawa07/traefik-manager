from app.infrastructure.persistence.models import AuditLogModel
from app.interfaces.api.v1.routers.audit_log_helpers import normalize_utc


def build_delivery_retry_chain(
    logs: list[AuditLogModel],
    target_audit_id: str,
) -> list[AuditLogModel]:
    logs_by_id = {str(log.id): log for log in logs}
    target = logs_by_id.get(target_audit_id)
    event = (target.detail or {}).get("event") if target else None
    if not isinstance(event, str) or "_alert_delivery_" not in event:
        return []

    children_by_parent: dict[str, list[str]] = {}
    for log in logs:
        parent_id = (log.detail or {}).get("retry_of_audit_id")
        if isinstance(parent_id, str):
            children_by_parent.setdefault(parent_id, []).append(str(log.id))

    chain_ids: set[str] = set()
    pending = [target_audit_id]
    while pending:
        audit_id = pending.pop()
        if audit_id in chain_ids or audit_id not in logs_by_id:
            continue
        chain_ids.add(audit_id)
        parent_id = (logs_by_id[audit_id].detail or {}).get("retry_of_audit_id")
        if isinstance(parent_id, str):
            pending.append(parent_id)
        pending.extend(children_by_parent.get(audit_id, []))

    return sorted(
        (logs_by_id[audit_id] for audit_id in chain_ids),
        key=lambda log: normalize_utc(log.created_at),
    )
