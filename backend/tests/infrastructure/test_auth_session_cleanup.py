import asyncio
from datetime import datetime, timezone

import pytest

from app.infrastructure.auth.session_cleanup import (
    cleanup_auth_state_once,
    run_periodic_auth_cleanup,
)


class StubAuthSessionRepository:
    def __init__(self, deleted_count: int):
        self.deleted_count = deleted_count
        self.calls: list[datetime] = []

    async def delete_inactive(self, now: datetime) -> int:
        self.calls.append(now)
        return self.deleted_count


class StubRevokedTokenRepository:
    def __init__(self, deleted_count: int):
        self.deleted_count = deleted_count
        self.calls: list[datetime] = []

    async def delete_expired(self, now: datetime) -> int:
        self.calls.append(now)
        return self.deleted_count


@pytest.mark.asyncio
async def test_cleanup_auth_state_once_deletes_inactive_sessions_and_expired_tokens():
    auth_sessions = StubAuthSessionRepository(deleted_count=2)
    revoked_tokens = StubRevokedTokenRepository(deleted_count=3)

    deleted_sessions, deleted_tokens = await cleanup_auth_state_once(
        auth_session_repository=auth_sessions,
        revoked_token_repository=revoked_tokens,
    )

    assert (deleted_sessions, deleted_tokens) == (2, 3)
    assert len(auth_sessions.calls) == 1
    assert len(revoked_tokens.calls) == 1
    assert auth_sessions.calls[0].tzinfo == timezone.utc
    assert revoked_tokens.calls[0].tzinfo == timezone.utc


@pytest.mark.asyncio
async def test_run_periodic_auth_cleanup_runs_cleanup_after_sleep():
    calls: list[str] = []

    async def fake_cleanup():
        calls.append("cleanup")

    sleep_calls: list[float] = []

    async def fake_sleep(seconds: float):
        sleep_calls.append(seconds)
        raise asyncio.CancelledError

    await run_periodic_auth_cleanup(
        interval_seconds=90,
        cleanup_once=fake_cleanup,
        sleep=fake_sleep,
    )

    assert calls == []
    assert sleep_calls == [90]

