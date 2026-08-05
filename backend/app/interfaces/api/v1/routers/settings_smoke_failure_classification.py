from typing import Any

from app.infrastructure.smoke_run_history import invalidate_smoke_history_cache
from app.interfaces.api.v1.routers.settings_smoke_failure_metadata import (
    read_smoke_failure_metadata,
    record_smoke_failure_metadata,
)
from app.interfaces.api.v1.schemas.settings_smoke_rotation_schemas import (
    SmokeFailureClassificationRequest,
    SmokeFailureClassificationResponse,
)


async def classify_smoke_failure_action(
    *,
    run_id: int,
    request: SmokeFailureClassificationRequest,
    actor: dict[str, Any],
    db: Any,
    settings_repository_factory: Any,
    audit_service: Any,
    client_ip: str | None = None,
) -> SmokeFailureClassificationResponse:
    repo = settings_repository_factory(db)
    existing = (await read_smoke_failure_metadata(repo)).get(run_id)
    entry = await record_smoke_failure_metadata(
        repo,
        run_id=run_id,
        metadata={
            "captured_at": (
                existing["captured_at"] if existing else request.completed_at.isoformat()
            ),
            "check_name": existing["check_name"] if existing else "관리자 수동 분류",
            "failure_type": request.failure_type,
            "screen_path": existing.get("screen_path") if existing else None,
            "page_title": existing.get("page_title") if existing else None,
        },
    )
    await invalidate_smoke_history_cache()
    await audit_service.record(
        db=db,
        actor=actor.get("username", "unknown"),
        action="update",
        resource_type="smoke_run",
        resource_id=str(run_id),
        resource_name=f"스모크 실행 #{run_id}",
        detail={
            "event": "smoke_failure_classified",
            "before_failure_type": existing.get("failure_type") if existing else None,
            "after_failure_type": request.failure_type,
            "client_ip": client_ip,
        },
        notify=False,
    )
    return SmokeFailureClassificationResponse(**entry)
