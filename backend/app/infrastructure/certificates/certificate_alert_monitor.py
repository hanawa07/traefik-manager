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
    }


def _to_event_name(status: str) -> str | None:
    if status == "warning":
        return "certificate_warning"
    if status == "error":
        return "certificate_error"
    return None


async def check_certificate_alerts_once(
    *,
    session_factory: Callable[[], Any] | None = None,
    client_factory: Callable[[], TraefikApiClient] | None = None,
    now: datetime | None = None,
) -> None:
    current_time = _to_utc(now) or datetime.now(timezone.utc)
    session_factory = session_factory or AsyncSessionLocal
    client_factory = client_factory or TraefikApiClient
    async with session_factory() as session:
        repo = SQLiteSystemSettingsRepository(session)
        previous_state = _deserialize_state(await repo.get(CERTIFICATE_ALERT_STATE_KEY))

        client = client_factory()
        try:
            certificates = await client.list_certificates()
        except TraefikApiClientError:
            logger.warning("인증서 알림 체크 실패 (Traefik API)", exc_info=True)
            return
        except Exception:
            logger.warning("인증서 알림 체크 실패", exc_info=True)
            return

        next_state: dict[str, dict[str, Any]] = {}
        for certificate in certificates:
            domain = certificate.get("domain")
            status = certificate.get("status")
            if not isinstance(domain, str) or not domain:
                continue
            if status not in {"active", "warning", "error"}:
                continue

            state_entry = _to_state_entry(certificate)
            next_state[domain] = state_entry

            event_name = _to_event_name(status)
            if event_name is None:
                continue

            previous_status = previous_state.get(domain, {}).get("status")
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

        await repo.set(CERTIFICATE_ALERT_STATE_KEY, _serialize_state(next_state))
        await session.commit()


async def run_periodic_certificate_alert_check(
    *,
    interval_seconds: int,
    check_once: Callable[[], Any],
) -> None:
    while True:
        await asyncio.sleep(interval_seconds)
        await check_once()
