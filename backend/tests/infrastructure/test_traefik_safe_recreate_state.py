import json

from app.infrastructure.traefik_safe_recreate_state import (
    read_checkpoint_summary,
    read_recovery_summary,
    select_latest_recovery,
)


def test_reads_safe_checkpoint_and_recovery_summaries(tmp_path):
    checkpoint_path = tmp_path / "checkpoint.json"
    checkpoint_path.write_text(
        json.dumps(
            {
                "schema_version": 1,
                "saved_at": "2026-08-26T08:47:17Z",
                "version": "v3.7.11",
                "config_hash": "not-exposed",
            }
        ),
        encoding="utf-8",
    )
    recovery_path = tmp_path / "recovery.json"
    recovery_path.write_text(
        json.dumps(
            {
                "schema_version": 1,
                "status": "rolled_back",
                "source": "manual_safe",
                "occurred_at": "2026-08-26T09:00:00Z",
            }
        ),
        encoding="utf-8",
    )

    assert read_checkpoint_summary(checkpoint_path) == {
        "status": "ready",
        "saved_at": "2026-08-26T08:47:17Z",
        "version": "v3.7.11",
    }
    assert read_recovery_summary(recovery_path) == {
        "status": "rolled_back",
        "occurred_at": "2026-08-26T09:00:00Z",
        "source": "manual_safe",
    }


def test_selects_latest_recovery_across_manual_and_patch_paths(tmp_path):
    missing = read_recovery_summary(tmp_path / "missing.json")
    latest = select_latest_recovery(
        [
            {
                "status": "rollback_failed",
                "completed_at": "2026-08-26T10:00:00Z",
            }
        ],
        {
            "status": "rolled_back",
            "occurred_at": "2026-08-26T09:00:00Z",
            "source": "manual_safe",
        },
    )

    assert missing == {"status": "none", "occurred_at": None, "source": None}
    assert latest == {
        "status": "rollback_failed",
        "occurred_at": "2026-08-26T10:00:00Z",
        "source": "patch_update",
    }


def test_rejects_invalid_or_linked_state_files(tmp_path):
    invalid = tmp_path / "invalid.json"
    invalid.write_text("not-json", encoding="utf-8")
    linked = tmp_path / "linked.json"
    linked.symlink_to(invalid)

    assert read_checkpoint_summary(invalid)["status"] == "invalid"
    assert read_recovery_summary(linked)["status"] == "invalid"
