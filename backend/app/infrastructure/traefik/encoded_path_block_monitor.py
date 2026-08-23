import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable

from app.application.audit import audit_service
from app.application.encoded_path_block_monitoring import (
    ENCODED_PATH_BLOCK_STATE_KEY,
    parse_encoded_path_block_monitor_state,
    read_encoded_path_block_monitoring_values,
)
from app.application.manager_health_monitoring import (
    read_manager_health_monitoring_values,
)
from app.infrastructure.persistence.database import AsyncSessionLocal
from app.infrastructure.persistence.repositories.sqlite_service_repository import (
    SQLiteServiceRepository,
)
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import (
    SQLiteSystemSettingsRepository,
)
from app.infrastructure.traefik.encoded_path_block_history import (
    collect_encoded_path_block_history,
    read_recent_encoded_path_block_stats,
)
from app.infrastructure.traefik.encoded_path_blocks import hash_request_host


async def check_encoded_path_blocks_once(
    *,
    session_factory: Callable[[], Any] | None = None,
    now: datetime | None = None,
    history_path: str | Path | None = None,
    cooldown_seconds: int | None = None,
) -> dict[str, object]:
    current = _to_utc(now)
    session_factory = session_factory or AsyncSessionLocal
    async with session_factory() as session:
        repo = SQLiteSystemSettingsRepository(session)
        monitoring = await read_encoded_path_block_monitoring_values(repo)
        previous = parse_encoded_path_block_monitor_state(
            await repo.get(ENCODED_PATH_BLOCK_STATE_KEY)
        )
        history = await collect_encoded_path_block_history(
            checked_at=current,
            path=history_path,
        )

        if not monitoring.enabled:
            if previous:
                await repo.set(ENCODED_PATH_BLOCK_STATE_KEY, None)
                await session.commit()
            return _summary(current, enabled=False, available=False)

        if not history.get("available") or not history.get("collection_available"):
            return _summary(current, enabled=True, available=False)

        stats = read_recent_encoded_path_block_stats(
            checked_at=current,
            window_minutes=monitoring.window_minutes,
            path=history_path,
        )
        if stats is None:
            return _summary(current, enabled=True, available=False)
        blocked_count = int(stats["blocked_request_count"])

        _, configured_cooldown_minutes = await read_manager_health_monitoring_values(repo)
        effective_cooldown_seconds = (
            cooldown_seconds
            if cooldown_seconds is not None
            else configured_cooldown_minutes * 60
        )
        breached = blocked_count >= monitoring.threshold
        was_active = bool(previous.get("alert_active"))
        event: str | None = None
        suppressed_count = 0
        if breached and (
            not was_active
            or _alert_due(previous, current, effective_cooldown_seconds)
        ):
            event = "traefik_encoded_path_blocks_high"
        elif breached:
            suppressed_count = 1
        elif was_active:
            event = "traefik_encoded_path_blocks_recovered"

        state = {
            "alert_active": breached,
            "last_alert_at": current.isoformat()
            if event == "traefik_encoded_path_blocks_high"
            else previous.get("last_alert_at"),
            "blocked_request_count": blocked_count,
        }
        await repo.set(
            ENCODED_PATH_BLOCK_STATE_KEY,
            json.dumps(state, ensure_ascii=False, sort_keys=True),
        )
        if event:
            target_routers = stats.get("target_routers")
            services = (
                await SQLiteServiceRepository(session).find_all()
                if isinstance(target_routers, list) and target_routers
                else []
            )
            target_services, other_target_request_count = _resolve_target_services(
                target_routers,
                services,
            )
            await audit_service.record(
                db=session,
                actor="system",
                action="alert",
                resource_type="traefik_security",
                resource_id="encoded-path-blocks",
                resource_name="Traefik 인코딩 경로 차단",
                detail={
                    "event": event,
                    "window_minutes": monitoring.window_minutes,
                    "blocked_request_count": blocked_count,
                    "total_request_count": stats.get("total_request_count", 0),
                    "blocked_request_percent": stats.get("blocked_request_percent"),
                    "request_count_complete": stats.get(
                        "request_count_complete", False
                    ),
                    "target_services": target_services,
                    "other_target_request_count": other_target_request_count,
                    "alert_threshold": monitoring.threshold,
                    "checked_at": current.isoformat(),
                    "cooldown_minutes": effective_cooldown_seconds // 60,
                },
            )
        await session.commit()
        return _summary(
            current,
            enabled=True,
            available=True,
            breached=breached,
            blocked_count=blocked_count,
            recorded_event_count=int(event is not None),
            suppressed_count=suppressed_count,
        )


def _alert_due(previous: dict[str, object], now: datetime, cooldown_seconds: int) -> bool:
    value = previous.get("last_alert_at")
    if not isinstance(value, str):
        return True
    try:
        last_alert_at = _to_utc(datetime.fromisoformat(value.replace("Z", "+00:00")))
    except ValueError:
        return True
    return now - last_alert_at >= timedelta(seconds=cooldown_seconds)


def _resolve_target_services(
    target_routers: object,
    services: list[Any],
    *,
    limit: int = 5,
) -> tuple[list[dict[str, object]], int]:
    services_by_host_hash = {
        host_hash: service
        for service in services
        if (host_hash := hash_request_host(str(service.domain))) is not None
    }
    service_candidates = sorted(
        (
            (str(service.domain).replace(".", "-"), service)
            for service in services
        ),
        key=lambda item: len(item[0]),
        reverse=True,
    )
    totals: dict[str, dict[str, object]] = {}
    other_target_request_count = 0
    for target in target_routers if isinstance(target_routers, list) else []:
        if not isinstance(target, dict):
            continue
        router_name = target.get("router_name")
        count = target.get("blocked_request_count")
        if not isinstance(router_name, str) or not isinstance(count, int):
            continue
        router_base = router_name.split("@", 1)[0]
        if router_base.startswith("host:"):
            matched_service = services_by_host_hash.get(
                router_base.removeprefix("host:")
            )
        else:
            matched_service = next(
                (
                    service
                    for safe_domain, service in service_candidates
                    if router_base == safe_domain
                    or router_base.startswith(f"{safe_domain}-")
                ),
                None,
            )
        if matched_service is None and (
            router_base.startswith("host:") or router_base == "unknown"
        ):
            other_target_request_count += count
            continue
        domain = str(matched_service.domain) if matched_service else None
        key = domain or router_base
        current = totals.setdefault(
            key,
            {
                "service_name": (
                    matched_service.name
                    if matched_service
                    else "알 수 없음" if router_base == "unknown" else router_base
                ),
                "domain": domain,
                "blocked_request_count": 0,
            },
        )
        current["blocked_request_count"] = (
            int(current["blocked_request_count"]) + count
        )

    ordered = sorted(
        totals.values(),
        key=lambda item: (-int(item["blocked_request_count"]), str(item["service_name"])),
    )
    return ordered[:limit], other_target_request_count + sum(
        int(item["blocked_request_count"]) for item in ordered[limit:]
    )


def _to_utc(value: datetime | None) -> datetime:
    current = value or datetime.now(timezone.utc)
    if current.tzinfo is None:
        return current.replace(tzinfo=timezone.utc)
    return current.astimezone(timezone.utc)


def _summary(
    current: datetime,
    *,
    enabled: bool,
    available: bool,
    breached: bool = False,
    blocked_count: int = 0,
    recorded_event_count: int = 0,
    suppressed_count: int = 0,
) -> dict[str, object]:
    return {
        "enabled": enabled,
        "available": available,
        "checked_at": current.isoformat(),
        "breached": breached,
        "blocked_request_count": blocked_count,
        "recorded_event_count": recorded_event_count,
        "suppressed_count": suppressed_count,
    }
