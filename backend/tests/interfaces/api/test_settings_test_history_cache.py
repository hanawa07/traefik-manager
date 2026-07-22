import asyncio
from types import SimpleNamespace

import pytest

from app.interfaces.api.v1.routers import settings_test_history
from app.interfaces.api.v1.routers.settings_test_history_builder import (
    build_settings_test_history_response,
)


@pytest.mark.asyncio
async def test_settings_test_history_coalesces_concurrent_loads(monkeypatch):
    expected = build_settings_test_history_response([])
    load_count = 0

    async def load_response(_db):
        nonlocal load_count
        load_count += 1
        await asyncio.sleep(0.01)
        return expected

    monkeypatch.setattr(
        settings_test_history,
        "_load_settings_test_history_response",
        load_response,
    )
    monkeypatch.setattr(settings_test_history, "_history_cache_lock", asyncio.Lock())
    monkeypatch.setattr(settings_test_history, "_history_cache_bind", None)
    monkeypatch.setattr(settings_test_history, "_history_cache_response", None)
    monkeypatch.setattr(settings_test_history, "_history_cache_expires_at", 0.0)
    db = SimpleNamespace(bind=object())

    responses = await asyncio.gather(
        *(
            settings_test_history.get_settings_test_history_response(db)
            for _ in range(12)
        )
    )

    assert load_count == 1
    assert all(response is expected for response in responses)
