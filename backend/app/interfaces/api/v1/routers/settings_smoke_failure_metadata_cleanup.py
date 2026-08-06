from typing import Any

from app.infrastructure.smoke_run_history import invalidate_smoke_history_cache
from app.interfaces.api.v1.routers.settings_smoke_failure_metadata import (
    delete_smoke_failure_metadata,
)
from app.interfaces.api.v1.schemas.settings_smoke_rotation_schemas import (
    SmokeFailureMetadataCleanupRequest,
    SmokeFailureMetadataCleanupResponse,
)


async def cleanup_smoke_failure_metadata_action(
    *,
    request: SmokeFailureMetadataCleanupRequest,
    actor: dict[str, Any],
    db: Any,
    settings_repository_factory: Any,
    audit_service: Any,
    client_ip: str | None = None,
) -> SmokeFailureMetadataCleanupResponse:
    repo = settings_repository_factory(db)
    run_ids = set(request.run_ids)
    deleted_count, retained_count = await delete_smoke_failure_metadata(
        repo,
        run_ids=run_ids,
    )
    if deleted_count:
        await invalidate_smoke_history_cache()
    await audit_service.record(
        db=db,
        actor=actor.get("username", "unknown"),
        action="delete",
        resource_type="smoke_failure_metadata",
        resource_id="selected",
        resource_name=f"스모크 실패 분류 정보 {deleted_count}건",
        detail={
            "event": "smoke_failure_metadata_cleanup",
            "requested_run_ids": sorted(run_ids),
            "deleted_count": deleted_count,
            "retained_count": retained_count,
            "client_ip": client_ip,
        },
        notify=False,
    )
    return SmokeFailureMetadataCleanupResponse(
        deleted_count=deleted_count,
        retained_count=retained_count,
    )
