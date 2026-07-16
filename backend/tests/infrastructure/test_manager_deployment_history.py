import json
from pathlib import Path

from app.infrastructure.manager_deployment_history import read_manager_deployment_history


def _entry(*, status: str = "success", completed_at: str = "2026-07-16T09:01:00Z"):
    return {
        "status": status,
        "from_slot": "blue",
        "to_slot": "green",
        "active_slot": "green" if status == "success" else "blue",
        "version": "v1.38.75",
        "revision": "1" * 40,
        "started_at": "2026-07-16T09:00:00Z",
        "completed_at": completed_at,
        "probe_total": 10,
        "probe_failures": 0,
    }


def test_history_returns_newest_valid_entries_and_skips_malformed_lines(tmp_path: Path):
    history_path = tmp_path / "deployments.jsonl"
    older = _entry(completed_at="2026-07-16T09:01:00Z")
    newer = _entry(status="rolled_back", completed_at="2026-07-16T10:01:00Z")
    invalid = {**_entry(), "probe_failures": 11}
    history_path.write_text(
        "\n".join((json.dumps(older), "not-json", json.dumps(invalid), json.dumps(newer))),
        encoding="utf-8",
    )

    result = read_manager_deployment_history(history_path)

    assert [entry["status"] for entry in result] == ["rolled_back", "success"]


def test_history_returns_empty_list_when_file_is_missing(tmp_path: Path):
    assert read_manager_deployment_history(tmp_path / "missing.jsonl") == []
