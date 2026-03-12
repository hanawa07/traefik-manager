import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, Callable

from app.application.audit import audit_service
from app.core.config import settings
from app.infrastructure.persistence.database import AsyncSessionLocal
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import (
    SQLiteSystemSettingsRepository,
)
from app.infrastructure.traefik.traefik_api_client import TraefikApiClient, TraefikApiClientError

logger = logging.getLogger(__name__)

CERTIFICATE_ALERT_STATE_KEY = "certificate_alert_state"


def _to_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _serialize_state(certificates: dict[str, dict[str, Any]]) -> str:
    return json.dumps(certificates, ensure_ascii=False, sort_keys=True)


def _deserialize_state(raw: str | None) -> dict[str, dict[str, Any]]:
    if not raw:
        return {}
    try:
        loaded = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    if not isinstance(loaded, dict):
        return {}
    return {str(key): value for key, value in loaded.items() if isinstance(value, dict)}


def _to_state_entry(certificate: dict[str, Any]) -> dict[str, Any]:
    expires_at = _to_utc(certificate.get("expires_at"))
    return {
        "status": certificate.get("status"),
        "days_remaining": certificate.get("days_remaining"),
        "expires_at": expires_at.isoformat() if expires_at else None,
        "status_started_at": certificate.get("status_started_at"),
    }


def _to_event_name(status: str, previous_status: str | None = None) -> str | None:
    if status == "active" and previous_status in {"warning", "error"}:
        return "certificate_recovered"
    if status == "warning":
        return "certificate_warning"
    if status == "error":
        return "certificate_error"
    return None


async def get_certificate_alert_state(
    session,
) -> dict[str, dict[str, Any]]:
    repo = SQLiteSystemSettingsRepository(session)
    return _deserialize_state(await repo.get(CERTIFICATE_ALERT_STATE_KEY))


async def check_certificate_alerts_once(
    *,
    session_factory: Callable[[], Any] | None = None,
    client_factory: Callable[[], TraefikApiClient] | None = None,
    now: datetime | None = None,
    raise_on_error: bool = False,
) -> dict[str, Any]:
    current_time = _to_utc(now) or datetime.now(timezone.utc)
    session_factory = session_factory or AsyncSessionLocal
    client_factory = client_factory or TraefikApiClient
    async with session_factory() as session:
        repo = SQLiteSystemSettingsRepository(session)
        previous_state = await get_certificate_alert_state(session)

        client = client_factory()
        try:
            certificates = await client.list_certificates()
        except TraefikApiClientError:
            logger.warning("인증서 알림 체크 실패 (Traefik API)", exc_info=True)
            if raise_on_error:
                raise
            return _build_summary([], current_time, 0)
        except Exception:
            logger.warning("인증서 알림 체크 실패", exc_info=True)
            if raise_on_error:
                raise
            return _build_summary([], current_time, 0)

        next_state: dict[str, dict[str, Any]] = {}
        recorded_event_count = 0
        for certificate in certificates:
            domain = certificate.get("domain")
            status = certificate.get("status")
            if not isinstance(domain, str) or not domain:
                continue
            if status not in {"active", "warning", "error"}:
                continue

            state_entry = _to_state_entry(certificate)
            previous_entry = previous_state.get(domain, {})
            previous_status = previous_entry.get("status")
            if previous_status == status:
                state_entry["status_started_at"] = previous_entry.get("status_started_at") or current_time.isoformat()
            else:
                state_entry["status_started_at"] = current_time.isoformat()
            next_state[domain] = state_entry

            event_name = _to_event_name(status, previous_status)
            if event_name is None:
                continue

            if previous_status == status:
                continue

            expires_at = _to_utc(certificate.get("expires_at"))
            detail = {
                "event": event_name,
                "previous_status": previous_status,
                "days_remaining": certificate.get("days_remaining"),
                "expires_at": expires_at.isoformat() if expires_at else None,
                "status_message": certificate.get("status_message"),
                "router_names": certificate.get("router_names") or [],
                "checked_at": current_time.isoformat(),
                "status_started_at": state_entry["status_started_at"],
            }
            await audit_service.record(
                db=session,
                actor="system",
                action="alert",
                resource_type="certificate",
                resource_id=domain,
                resource_name=domain,
                detail=detail,
            )
            recorded_event_count += 1

        await repo.set(CERTIFICATE_ALERT_STATE_KEY, _serialize_state(next_state))
        await session.commit()
        return _build_summary(certificates, current_time, recorded_event_count)


async def run_periodic_certificate_alert_check(
    *,
    interval_seconds: int,
    check_once: Callable[[], Any],
) -> None:
    while True:
        await asyncio.sleep(interval_seconds)
        await check_once()


def _build_summary(
    certificates: list[dict[str, Any]],
    current_time: datetime,
    recorded_event_count: int,
) -> dict[str, Any]:
    return {
        "checked_at": current_time.isoformat(),
        "total_count": len(certificates),
        "warning_count": sum(1 for certificate in certificates if certificate.get("status") == "warning"),
        "error_count": sum(1 for certificate in certificates if certificate.get("status") == "error"),
        "recorded_event_count": recorded_event_count,
    }
