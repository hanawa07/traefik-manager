import pytest

from app import app_lifespan


@pytest.mark.asyncio
async def test_background_tasks_propagate_dynamic_config_sync_failure(monkeypatch):
    async def ready():
        pass

    async def failed():
        raise RuntimeError("sync failed")

    monkeypatch.setattr(app_lifespan, "ensure_service_route_files", ready)
    monkeypatch.setattr(app_lifespan, "ensure_authentik_middleware_file", failed)
    monkeypatch.setattr(app_lifespan, "ensure_traefik_dashboard_public_route", ready)

    with pytest.raises(RuntimeError, match="sync failed"):
        await app_lifespan.run_active_background_tasks()
