from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from app.application.auth.login_anomaly_logs import get_log_created_at, normalize_utc

LOGIN_FAILURE_EVENTS = {"login_failure", "login_locked"}
SECURITY_CHALLENGE_EVENTS = {"login_suspicious", "login_blocked_ip"}


@dataclass(frozen=True)
class SuspiciousIpBlockDecision:
    blocked: bool
    detail: dict[str, Any] | None = None


def build_suspicious_login_detail(
    *,
    logs: list,
    client_ip: str,
    min_failures: int,
    min_unique_usernames: int,
) -> dict[str, Any] | None:
    failure_logs = []
    for log in logs:
        detail = log.detail or {}
        if detail.get("event") == "login_suspicious":
            return None
        if detail.get("event") in LOGIN_FAILURE_EVENTS:
            failure_logs.append(log)

    usernames = {log.resource_name for log in failure_logs if log.resource_name}
    if len(failure_logs) < min_failures or len(usernames) < min_unique_usernames:
        return None

    return {
        "event": "login_suspicious",
        "client_ip": client_ip,
        "failure_count": len(failure_logs),
        "unique_usernames": len(usernames),
        "usernames": sorted(usernames),
    }


def decide_suspicious_ip_block(
    *,
    logs: list,
    client_ip: str,
    now: datetime,
    block_window: timedelta,
    escalation_enabled: bool,
    escalation_multiplier: int,
    max_block_window: timedelta | None,
) -> SuspiciousIpBlockDecision:
    suspicious_logs = [
        log for log in logs
        if (log.detail or {}).get("event") == "login_suspicious"
    ]
    if not suspicious_logs:
        return SuspiciousIpBlockDecision(blocked=False)

    latest_suspicious_at = max(get_log_created_at(log) for log in suspicious_logs)
    blocked_logs = sorted(
        [
            log
            for log in logs
            if (log.detail or {}).get("event") == "login_blocked_ip"
        ],
        key=get_log_created_at,
    )
    latest_block_log = blocked_logs[-1] if blocked_logs else None
    if latest_block_log is not None:
        latest_blocked_at = get_log_created_at(latest_block_log)
        blocked_until = get_blocked_until(latest_block_log, default_window=block_window)
        if blocked_until > now:
            return SuspiciousIpBlockDecision(blocked=True)
        if latest_suspicious_at <= latest_blocked_at:
            return SuspiciousIpBlockDecision(blocked=False)

    base_block_minutes = max(1, int(block_window.total_seconds() // 60))
    block_minutes = base_block_minutes
    repeat_count = 1
    if escalation_enabled:
        previous_block_count = len(blocked_logs)
        repeat_count = previous_block_count + 1
        block_minutes = base_block_minutes * (escalation_multiplier ** previous_block_count)
        if max_block_window is not None:
            max_block_minutes = max(1, int(max_block_window.total_seconds() // 60))
            block_minutes = min(block_minutes, max_block_minutes)

    blocked_until = now + timedelta(minutes=block_minutes)
    return SuspiciousIpBlockDecision(
        blocked=True,
        detail={
            "event": "login_blocked_ip",
            "client_ip": client_ip,
            "source_event": "login_suspicious",
            "source_created_at": latest_suspicious_at.isoformat(),
            "block_minutes": block_minutes,
            "blocked_until": blocked_until.isoformat(),
            "repeat_count": repeat_count,
            "escalated": block_minutes > base_block_minutes,
        },
    )


def should_require_turnstile_from_logs(
    *,
    logs: list,
    failure_threshold: int,
) -> bool:
    failure_count = 0
    for log in logs:
        detail = log.detail or {}
        event = detail.get("event")
        if event in SECURITY_CHALLENGE_EVENTS:
            return True
        if event in LOGIN_FAILURE_EVENTS:
            failure_count += 1
    return failure_count >= failure_threshold


def get_blocked_until(log, *, default_window: timedelta) -> datetime:
    detail = log.detail or {}
    raw_blocked_until = detail.get("blocked_until")
    if isinstance(raw_blocked_until, str):
        try:
            return normalize_utc(datetime.fromisoformat(raw_blocked_until))
        except ValueError:
            pass

    raw_block_minutes = detail.get("block_minutes")
    try:
        block_minutes = int(raw_block_minutes)
        if block_minutes > 0:
            return get_log_created_at(log) + timedelta(minutes=block_minutes)
    except (TypeError, ValueError):
        pass

    return get_log_created_at(log) + default_window
