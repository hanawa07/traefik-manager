import json
from pathlib import Path

from app.infrastructure.manager_deployment_history import (
    read_manager_deployment_history,
    read_manager_deployment_history_archive,
    read_manager_deployment_history_archive_with_summary,
)


def _entry(*, status: str = "success", completed_at: str = "2026-07-16T09:01:00Z"):
    entry = {
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
    if status != "success":
        entry["failure_stage"] = "public_probe"
        entry["failure_reason"] = "HTTP 비정상 1/10건 · 자동 rollback 완료"
    if status == "rollback_failed":
        entry["alert_request_status"] = "requested"
        entry["alert_run_url"] = (
            "https://github.com/hanawa07/traefik-manager/actions/runs/123"
        )
    return entry


def test_history_returns_newest_valid_entries_and_skips_malformed_lines(tmp_path: Path):
    history_path = tmp_path / "deployments.jsonl"
    older = _entry(completed_at="2026-07-16T09:01:00Z")
    newer = _entry(status="rollback_failed", completed_at="2026-07-16T10:01:00Z")
    older["stage_durations_ms"] = {
        "prepare": 1000,
        "build": -1,
        "public_probe": True,
        "unknown": 500,
    }
    newer["stage_durations_ms"] = {"prepare": 1000, "public_probe": 5000}
    invalid = {**_entry(), "probe_failures": 11}
    invalid_stage = {**_entry(status="rolled_back"), "failure_stage": "shell_command"}
    invalid_alert_status = {
        **_entry(status="rollback_failed"),
        "alert_request_status": ["requested"],
    }
    invalid_alert_url = {
        **_entry(status="rollback_failed"),
        "alert_run_url": "https://example.com/actions/runs/123",
    }
    history_path.write_text(
        "\n".join(
            (
                json.dumps(older),
                "not-json",
                json.dumps(invalid),
                json.dumps(invalid_stage),
                json.dumps(invalid_alert_status),
                json.dumps(invalid_alert_url),
                json.dumps(newer),
            )
        ),
        encoding="utf-8",
    )

    result = read_manager_deployment_history(history_path)

    assert [entry["status"] for entry in result] == ["rollback_failed", "success"]
    assert result[0]["failure_stage"] == "public_probe"
    assert result[0]["alert_request_status"] == "requested"
    assert result[0]["alert_run_url"].endswith("/actions/runs/123")
    assert result[0]["stage_durations_ms"] == {"prepare": 1000, "public_probe": 5000}
    assert result[1]["failure_stage"] is None
    assert result[1]["alert_request_status"] == "not_needed"
    assert result[1]["alert_run_url"] is None
    assert result[1]["stage_durations_ms"] == {"prepare": 1000}


def test_history_returns_empty_list_when_file_is_missing(tmp_path: Path):
    assert read_manager_deployment_history(tmp_path / "missing.jsonl") == []


def test_archive_returns_only_entries_not_retained_in_current_file(tmp_path: Path):
    history_path = tmp_path / "deployments.jsonl"
    entries = [
        _entry(completed_at=f"2026-07-16T0{hour}:01:00Z")
        for hour in range(1, 5)
    ]
    lines = [json.dumps(entry) for entry in entries]
    history_path.write_text("\n".join(lines[2:]), encoding="utf-8")
    Path(f"{history_path}.1").write_text(
        "\n".join([*lines, "not-json"]),
        encoding="utf-8",
    )

    result = read_manager_deployment_history_archive(history_path)

    assert [entry["completed_at"] for entry in result] == [
        "2026-07-16T02:01:00Z",
        "2026-07-16T01:01:00Z",
    ]


def test_archive_merges_daily_entries_in_time_order_and_applies_limit(tmp_path: Path):
    history_path = tmp_path / "deployments.jsonl"
    entries = [
        _entry(completed_at=f"2026-07-{day:02d}T09:01:00Z")
        for day in range(10, 15)
    ]
    lines = [json.dumps(entry) for entry in entries]
    history_path.write_text(lines[4], encoding="utf-8")
    Path(f"{history_path}.1").write_text("\n".join(lines[2:]), encoding="utf-8")
    Path(f"{history_path}.daily").write_text("\n".join(lines[:3]), encoding="utf-8")

    result, summary = read_manager_deployment_history_archive_with_summary(
        history_path,
        limit=3,
    )

    assert [entry["completed_at"] for entry in result] == [
        "2026-07-13T09:01:00Z",
        "2026-07-12T09:01:00Z",
        "2026-07-11T09:01:00Z",
    ]
    assert summary == {
        "detailed_count": 2,
        "daily_count": 1,
        "newest_at": "2026-07-13T09:01:00Z",
        "oldest_at": "2026-07-11T09:01:00Z",
    }


def test_archive_uses_daily_entries_beyond_detailed_cap(tmp_path: Path):
    history_path = tmp_path / "deployments.jsonl"
    entries = [
        _entry(completed_at=f"2026-07-{day:02d}T09:01:00Z")
        for day in range(1, 28)
    ]
    lines = [json.dumps(entry) for entry in entries]
    history_path.write_text(lines[-1], encoding="utf-8")
    Path(f"{history_path}.1").write_text("\n".join(lines[:-1]), encoding="utf-8")
    Path(f"{history_path}.daily").write_text("\n".join(lines[:-1]), encoding="utf-8")

    result, summary = read_manager_deployment_history_archive_with_summary(history_path)

    completed_dates = [str(entry["completed_at"])[:10] for entry in result]
    assert len(completed_dates) == 26
    assert completed_dates[0] == "2026-07-26"
    assert completed_dates[-1] == "2026-07-01"
    assert len(set(completed_dates)) == len(completed_dates)
    assert summary["detailed_count"] == 20
    assert summary["daily_count"] == 6
