import pytest
from fastapi import HTTPException

from app.interfaces.api.v1.routers.settings_smoke_run_action import (
    record_smoke_run_success_action,
)


class StubRepository:
    def __init__(self) -> None:
        self.values = {}

    async def set(self, key: str, value: str) -> None:
        self.values[key] = value


@pytest.mark.asyncio
async def test_record_smoke_run_success_accepts_dedicated_viewer() -> None:
    repo = StubRepository()

    response = await record_smoke_run_success_action(
        run_id=123,
        actor={"username": "traefik-smoke-viewer", "role": "viewer"},
        db=object(),
        settings_repository_factory=lambda _db: repo,
        admin_checked=True,
    )

    assert response.run_url.endswith("/actions/runs/123")
    assert repo.values["dashboard_smoke_last_success_at"] == response.recorded_at
    assert repo.values["dashboard_smoke_last_run_url"] == response.run_url
    assert repo.values["dashboard_smoke_admin_last_success_at"] == response.recorded_at
    assert repo.values["dashboard_smoke_admin_last_run_url"] == response.run_url


@pytest.mark.asyncio
async def test_record_smoke_run_success_rejects_other_user() -> None:
    with pytest.raises(HTTPException) as exc_info:
        await record_smoke_run_success_action(
            run_id=123,
            actor={"username": "admin", "role": "admin"},
            db=object(),
            settings_repository_factory=lambda _db: StubRepository(),
        )

    assert exc_info.value.status_code == 403
