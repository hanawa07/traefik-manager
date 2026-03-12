import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Callable

from app.application.certificate.preflight_service import (
    get_certificate_preflight_state,
    record_certificate_preflight_result,
)
from app.core.certificate_diagnostics import build_certificate_diagnostics_settings
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import SQLiteSystemSettingsRepository
from app.infrastructure.persistence.database import AsyncSessionLocal
from app.infrastructure.traefik.traefik_api_client import TraefikApiClient, TraefikApiClientError

logger = logging.getLogger(__name__)


def _to_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _should_run_preflight(certificate: dict[str, Any], preflight_state: dict | None) -> bool:
    status = certificate.get("status")
    if status in {"warning", "error", "pending"}:
        return True
    if certificate.get("last_acme_error_message"):
        return True
    if isinstance(preflight_state, dict) and preflight_state.get("repeated_failure_active"):
        return True
    return False


async def run_certificate_preflight_checks_once(
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
        client = client_factory()
        diagnostics_settings = await _load_certificate_diagnostics_settings(session)
        try:
            certificates = await client.list_certificates()
        except TraefikApiClientError:
            logger.warning("인증서 프리플라이트 자동 점검 실패 (Traefik API)", exc_info=True)
            if raise_on_error:
                raise
            return _build_summary(current_time, 0, 0, 0)
        except Exception:
            logger.warning("인증서 프리플라이트 자동 점검 실패", exc_info=True)
            if raise_on_error:
                raise
            return _build_summary(current_time, 0, 0, 0)

        preflight_state = await get_certificate_preflight_state(session, config=diagnostics_settings)
        candidates = [
            certificate
            for certificate in certificates
            if isinstance(certificate.get("domain"), str)
            and _should_run_preflight(certificate, preflight_state.get(certificate["domain"]))
        ]

        checked_count = 0
        recorded_event_count = 0
        for certificate in candidates:
            domain = certificate["domain"]
            result = await client.get_certificate_preflight(domain, certificates=certificates)
            tracking = await record_certificate_preflight_result(
                db=session,
                actor="system",
                domain=domain,
                result=result,
                client_ip=None,
                config=diagnostics_settings,
            )
            checked_count += 1
            if tracking["repeated_failure_emitted"]:
                recorded_event_count += 1

        await session.commit()
        return _build_summary(current_time, len(candidates), checked_count, recorded_event_count)


async def run_periodic_certificate_preflight_check(
    *,
    interval_seconds: int,
    check_once: Callable[[], Any],
) -> None:
    while True:
        await asyncio.sleep(interval_seconds)
        await check_once()


def _build_summary(
    current_time: datetime,
    candidate_count: int,
    checked_count: int,
    recorded_event_count: int,
) -> dict[str, Any]:
    return {
        "checked_at": current_time.isoformat(),
        "candidate_count": candidate_count,
        "checked_count": checked_count,
        "recorded_event_count": recorded_event_count,
    }


async def _load_certificate_diagnostics_settings(session: Any):
    if not callable(getattr(session, "execute", None)):
        return build_certificate_diagnostics_settings()
    return build_certificate_diagnostics_settings(await SQLiteSystemSettingsRepository(session).get_all_dict())
