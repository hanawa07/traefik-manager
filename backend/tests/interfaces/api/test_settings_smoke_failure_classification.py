import json

import pytest

from app.interfaces.api.v1.routers.settings_smoke_failure_classification import (
    classify_smoke_failure_action,
)
from app.interfaces.api.v1.schemas.settings_smoke_rotation_schemas import (
    SmokeFailureClassificationRequest,
)


class StubRepository:
    def __init__(self) -> None:
        self.values: dict[str, str] = {}

    async def get(self, key: str) -> str | None:
        return self.values.get(key)

    async def set(self, key: str, value: str) -> None:
        self.values[key] = value


class StubAuditService:
    def __init__(self) -> None:
        self.records: list[dict] = []

    async def record(self, **kwargs) -> None:
        self.records.append(kwargs)


@pytest.mark.asyncio
async def test_admin_classifies_unclassified_run_with_original_completion_time() -> None:
    repo = StubRepository()
    audit = StubAuditService()

    response = await classify_smoke_failure_action(
        run_id=987,
        request=SmokeFailureClassificationRequest(
            failure_type="login",
            completed_at="2026-07-18T03:04:05Z",
        ),
        actor={"username": "lizstudio", "role": "admin"},
        db=object(),
        settings_repository_factory=lambda _db: repo,
        audit_service=audit,
        client_ip="127.0.0.1",
    )

    stored = json.loads(repo.values["dashboard_smoke_failure_metadata"])[0]
    assert response.run_id == 987
    assert response.failure_type == "login"
    assert stored["captured_at"] == "2026-07-18T03:04:05+00:00"
    assert stored["check_name"] == "관리자 수동 분류"
    assert audit.records[0]["notify"] is False
    assert audit.records[0]["detail"] == {
        "event": "smoke_failure_classified",
        "before_failure_type": None,
        "after_failure_type": "login",
        "client_ip": "127.0.0.1",
    }
