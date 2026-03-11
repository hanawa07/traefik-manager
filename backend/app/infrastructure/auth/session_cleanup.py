import asyncio
from datetime import datetime, timezone


def _to_utc(value: datetime | None) -> datetime:
    current = value or datetime.now(timezone.utc)
    if current.tzinfo is None:
        return current.replace(tzinfo=timezone.utc)
    return current.astimezone(timezone.utc)


async def cleanup_auth_state_once(
    auth_session_repository,
    revoked_token_repository,
    now: datetime | None = None,
) -> tuple[int, int]:
    cleanup_at = _to_utc(now)
    deleted_sessions = await auth_session_repository.delete_inactive(cleanup_at)
    deleted_tokens = await revoked_token_repository.delete_expired(cleanup_at)
    return deleted_sessions, deleted_tokens


async def run_periodic_auth_cleanup(
    interval_seconds: int,
    cleanup_once,
    sleep=asyncio.sleep,
) -> None:
    while True:
        try:
            await sleep(interval_seconds)
        except asyncio.CancelledError:
            return
        await cleanup_once()
