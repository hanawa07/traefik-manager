import argparse
import asyncio
import os
from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any

from app.application.audit import audit_service
from app.core.smoke_rotation_status import (
    SMOKE_ROTATION_DETAIL_KEY,
    SMOKE_ROTATION_LAST_ATTEMPT_AT_KEY,
    SMOKE_ROTATION_LAST_SUCCESS_AT_KEY,
    SMOKE_ROTATION_STATUSES,
    SMOKE_ROTATION_STATUS_KEY,
)
from app.infrastructure.persistence.database import AsyncSessionLocal
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import (
    SQLiteSystemSettingsRepository,
)


async def record_smoke_rotation_status(
    *,
    db: Any,
    repo: Any,
    status: str,
    detail: str | None = None,
    now: datetime | None = None,
    audit_recorder: Callable[..., Any] = audit_service.record,
) -> None:
    if status not in SMOKE_ROTATION_STATUSES:
        raise ValueError(f"지원하지 않는 회전 상태입니다: {status}")

    recorded_at = (now or datetime.now(timezone.utc)).isoformat()
    safe_detail = (detail or "").strip()[:200] or None
    await repo.set(SMOKE_ROTATION_STATUS_KEY, status)
    await repo.set(SMOKE_ROTATION_LAST_ATTEMPT_AT_KEY, recorded_at)
    await repo.set(SMOKE_ROTATION_DETAIL_KEY, safe_detail)

    audit_event = None
    if status == "success":
        await repo.set(SMOKE_ROTATION_LAST_SUCCESS_AT_KEY, recorded_at)
        audit_event = "smoke_rotation_succeeded"
    elif status == "failure":
        audit_event = "smoke_rotation_failed"

    if audit_event:
        audit_detail = {"event": audit_event}
        if status == "failure":
            audit_detail["step"] = safe_detail or "알 수 없는 단계"
        await audit_recorder(
            db=db,
            actor="system",
            action="rotate",
            resource_type="user",
            resource_id="smoke-accounts",
            resource_name="스모크 viewer·admin",
            detail=audit_detail,
        )


async def report_smoke_rotation(status: str, detail: str | None = None) -> None:
    async with AsyncSessionLocal() as db:
        repo = SQLiteSystemSettingsRepository(db)
        await record_smoke_rotation_status(db=db, repo=repo, status=status, detail=detail)
        await db.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description="스모크 계정 비밀번호 회전 결과 기록")
    parser.add_argument(
        "status",
        nargs="?",
        default=os.getenv("TM_SMOKE_ROTATION_STATUS"),
        choices=sorted(SMOKE_ROTATION_STATUSES),
    )
    parser.add_argument("--detail", default=os.getenv("TM_SMOKE_ROTATION_DETAIL"))
    args = parser.parse_args()
    if args.status is None:
        parser.error("status가 필요합니다")

    asyncio.run(report_smoke_rotation(args.status, args.detail))
    print(f"스모크 계정 회전 상태 기록 완료: {args.status}")


if __name__ == "__main__":
    main()
