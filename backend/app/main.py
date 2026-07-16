import asyncio
from contextlib import asynccontextmanager, suppress
from pathlib import Path

from fastapi import FastAPI

from app.background_task_supervisor import supervise_background_tasks
from app.app_factory import create_app
from app.app_lifespan import run_active_background_tasks
from app.core.config import settings
from app.core.logging_config import setup_logging
from app.infrastructure.persistence.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    await init_db()
    config_root = Path(settings.TRAEFIK_CONFIG_PATH).parent
    background_task = asyncio.create_task(
        supervise_background_tasks(
            enabled=settings.TRAEFIK_MANAGER_BACKGROUND_TASKS_ENABLED,
            slot=settings.TRAEFIK_MANAGER_SLOT,
            route_path=Path(settings.TRAEFIK_CONFIG_PATH) / "traefik-manager-self.yml",
            lease_path=config_root / ".background-tasks.lock",
            run_active=run_active_background_tasks,
        )
    )
    try:
        yield
    finally:
        background_task.cancel()
        with suppress(asyncio.CancelledError):
            await background_task


app = create_app(lifespan=lifespan)
