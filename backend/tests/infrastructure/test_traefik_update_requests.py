import json
from datetime import datetime, timezone

import pytest

from app.infrastructure.traefik_update_requests import (
    TraefikUpdateAlreadyPendingError,
    queue_traefik_alert_retry,
    queue_traefik_patch_update,
)


def test_queue_traefik_patch_update_creates_single_strict_request(tmp_path):
    request_dir = tmp_path / "requests"
    request_dir.mkdir()
    now = datetime(2026, 7, 20, 1, 2, 3, tzinfo=timezone.utc)

    queued = queue_traefik_patch_update(
        target_version="3.7.9",
        actor="lizstudio",
        request_dir=request_dir,
        now=now,
    )

    request_path = request_dir / "traefik-update-request.json"
    payload = json.loads(request_path.read_text(encoding="utf-8"))
    assert queued["status"] == "queued"
    assert payload == {
        "schema_version": 1,
        "operation": "traefik_patch_update",
        "request_id": queued["request_id"],
        "target_version": "v3.7.9",
        "actor": "lizstudio",
        "requested_at": "2026-07-20T01:02:03Z",
    }
    assert request_path.stat().st_mode & 0o777 == 0o644
    assert list(request_dir.glob("*.tmp")) == []
    with pytest.raises(TraefikUpdateAlreadyPendingError):
        queue_traefik_patch_update(
            target_version="v3.7.9",
            actor="lizstudio",
            request_dir=request_dir,
        )


def test_queue_traefik_alert_retry_keeps_source_request(tmp_path):
    request_dir = tmp_path / "requests"
    request_dir.mkdir()
    now = datetime(2026, 7, 20, 1, 2, 3, tzinfo=timezone.utc)
    source_request_id = "11111111-1111-4111-8111-111111111111"

    queued = queue_traefik_alert_retry(
        source_request_id=source_request_id,
        target_version="v3.7.9",
        actor="lizstudio",
        request_dir=request_dir,
        now=now,
    )

    payload = json.loads(
        (request_dir / "traefik-update-request.json").read_text(encoding="utf-8")
    )
    assert payload == {
        "schema_version": 1,
        "operation": "traefik_rollback_alert_retry",
        "request_id": queued["request_id"],
        "source_request_id": source_request_id,
        "target_version": "v3.7.9",
        "actor": "lizstudio",
        "requested_at": "2026-07-20T01:02:03Z",
    }
    assert queued["status"] == "queued"
