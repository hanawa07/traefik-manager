import json
from datetime import datetime, timedelta, timezone

import pytest

from app.infrastructure.traefik_update_operations import (
    TraefikUpdateAlreadyPendingError,
    queue_traefik_patch_update,
    read_traefik_update_operations,
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


def test_read_traefik_update_operations_returns_latest_request_state(tmp_path):
    request_dir = tmp_path / "requests"
    request_dir.mkdir()
    (request_dir / "traefik-update-request.json").write_text("{}", encoding="utf-8")
    checked_at = datetime(2026, 7, 20, 1, 2, 3, tzinfo=timezone.utc)
    runner_path = tmp_path / "runner.json"
    runner_path.write_text(
        json.dumps(
            {
                "status": "ready",
                "checked_at": checked_at.isoformat(),
                "message": "ready",
            }
        ),
        encoding="utf-8",
    )
    request_id = "11111111-1111-4111-8111-111111111111"
    base_entry = {
        "request_id": request_id,
        "actor": "lizstudio",
        "from_version": "v3.7.8",
        "target_version": "v3.7.9",
        "requested_at": "2026-07-20T01:00:00Z",
        "started_at": "2026-07-20T01:00:01Z",
        "completed_at": None,
        "message": "running",
        "backup_dir": None,
        "backup_created": False,
        "rollback_performed": False,
        "validations": [],
    }
    history_path = tmp_path / "history.jsonl"
    history_path.write_text(
        "\n".join(
            [
                json.dumps({**base_entry, "status": "running"}),
                "not-json",
                json.dumps(
                    {
                        **base_entry,
                        "status": "success",
                        "completed_at": "2026-07-20T01:00:05Z",
                        "message": "completed",
                        "backup_dir": "/tmp/backups/request",
                        "backup_created": True,
                        "validations": [
                            {
                                "key": "container_version",
                                "status": "ok",
                                "message": "v3.7.9",
                            }
                        ],
                    }
                ),
            ]
        ),
        encoding="utf-8",
    )

    result = read_traefik_update_operations(
        history_path=history_path,
        request_dir=request_dir,
        runner_status_path=runner_path,
        now=checked_at + timedelta(seconds=30),
    )

    assert result["runner"]["available"] is True
    assert result["pending_request"] is True
    assert len(result["history"]) == 1
    assert result["history"][0]["status"] == "success"
    assert result["history"][0]["backup_created"] is True


def test_read_traefik_update_operations_rejects_stale_runner(tmp_path):
    request_dir = tmp_path / "requests"
    request_dir.mkdir()
    runner_path = tmp_path / "runner.json"
    runner_path.write_text(
        json.dumps(
            {
                "status": "ready",
                "checked_at": "2026-07-20T01:00:00Z",
                "message": "ready",
            }
        ),
        encoding="utf-8",
    )

    result = read_traefik_update_operations(
        history_path=tmp_path / "missing.jsonl",
        request_dir=request_dir,
        runner_status_path=runner_path,
        now=datetime(2026, 7, 20, 1, 10, tzinfo=timezone.utc),
    )

    assert result["runner"]["available"] is False
    assert result["runner"]["status"] == "stale"
    assert result["history"] == []
