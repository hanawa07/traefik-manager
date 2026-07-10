import pytest

from app.interfaces.api.v1.routers.settings_smoke_rotation_response import (
    get_smoke_rotation_status_response,
)


class StubRepository:
    values: dict[str, str] = {}

    def __init__(self, _db):
        pass

    async def get(self, key: str) -> str | None:
        return self.values.get(key)


@pytest.mark.asyncio
async def test_get_smoke_rotation_status_returns_saved_result() -> None:
    StubRepository.values = {
        "smoke_viewer_rotation_status": "failure",
        "smoke_viewer_rotation_last_attempt_at": "2026-07-10T04:17:00+00:00",
        "smoke_viewer_rotation_last_success_at": "2026-06-01T04:17:00+00:00",
        "smoke_viewer_rotation_detail": "GitHub secret 갱신",
    }

    result = await get_smoke_rotation_status_response(
        object(),
        settings_repository_factory=StubRepository,
    )

    assert result.status == "failure"
    assert result.last_attempt_at == "2026-07-10T04:17:00+00:00"
    assert result.last_success_at == "2026-06-01T04:17:00+00:00"
    assert result.detail == "GitHub secret 갱신"


@pytest.mark.asyncio
async def test_get_smoke_rotation_status_defaults_to_never() -> None:
    StubRepository.values = {"smoke_viewer_rotation_status": "unexpected"}

    result = await get_smoke_rotation_status_response(
        object(),
        settings_repository_factory=StubRepository,
    )

    assert result.status == "never"
