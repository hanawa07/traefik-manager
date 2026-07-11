from datetime import datetime, timezone
from typing import Any

from app.core.config import settings

SMOKE_MONITORING_LAST_SUCCESS_AT_KEY = "dashboard_smoke_last_success_at"
SMOKE_MONITORING_LAST_RUN_URL_KEY = "dashboard_smoke_last_run_url"


def get_smoke_workflow_url() -> str:
    repository_url = settings.TRAEFIK_MANAGER_IMAGE_SOURCE.rstrip("/").removesuffix(".git")
    return f"{repository_url}/actions/workflows/dashboard-visual-smoke.yml"


async def read_smoke_run_status(repo: Any) -> dict[str, str | None]:
    return {
        "monitoring_last_success_at": await repo.get(SMOKE_MONITORING_LAST_SUCCESS_AT_KEY),
        "monitoring_last_run_url": await repo.get(SMOKE_MONITORING_LAST_RUN_URL_KEY),
        "monitoring_workflow_url": get_smoke_workflow_url(),
    }


async def record_smoke_run_success(
    repo: Any,
    *,
    run_id: int,
    now: datetime | None = None,
) -> dict[str, str]:
    recorded_at = (now or datetime.now(timezone.utc)).isoformat()
    repository_url = settings.TRAEFIK_MANAGER_IMAGE_SOURCE.rstrip("/").removesuffix(".git")
    run_url = f"{repository_url}/actions/runs/{run_id}"
    await repo.set(SMOKE_MONITORING_LAST_SUCCESS_AT_KEY, recorded_at)
    await repo.set(SMOKE_MONITORING_LAST_RUN_URL_KEY, run_url)
    return {"recorded_at": recorded_at, "run_url": run_url}
