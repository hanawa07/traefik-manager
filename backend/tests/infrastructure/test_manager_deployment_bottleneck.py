import json
from datetime import datetime
from pathlib import Path

from app.infrastructure.manager_deployment_bottleneck import (
    preview_manager_deployment_bottleneck_event_cleanup,
    prune_manager_deployment_bottleneck_events,
    read_manager_deployment_bottleneck_config,
    read_manager_deployment_bottleneck_events,
    read_manager_deployment_bottleneck_state,
    write_manager_deployment_bottleneck_config,
)


def test_bottleneck_config_round_trip_and_invalid_value_fallback(tmp_path: Path):
    config_path = tmp_path / "runtime" / "bottleneck.conf"

    assert read_manager_deployment_bottleneck_config(config_path) == {
        "threshold_ms": 60_000,
        "consecutive_count": 3,
        "event_retention_days": 90,
    }
    assert write_manager_deployment_bottleneck_config(45_000, 4, 120, config_path) == {
        "threshold_ms": 45_000,
        "consecutive_count": 4,
        "event_retention_days": 120,
    }
    assert config_path.stat().st_mode & 0o777 == 0o644

    config_path.write_text(
        "threshold_ms=bad\nconsecutive_count=99\nevent_retention_days=0\n",
        encoding="utf-8",
    )
    assert read_manager_deployment_bottleneck_config(config_path) == {
        "threshold_ms": 60_000,
        "consecutive_count": 3,
        "event_retention_days": 90,
    }


def test_bottleneck_state_reads_effective_check_and_rejects_foreign_run_url(tmp_path: Path):
    config_path = tmp_path / "bottleneck.conf"
    status_path = tmp_path / "bottleneck.status"
    write_manager_deployment_bottleneck_config(45_000, 4, 120, config_path)
    status_path.write_text(
        "\n".join(
            (
                "status=alerted",
                "checked_at=2026-07-17T00:00:00Z",
                "effective_threshold_ms=30000",
                "effective_consecutive_count=2",
                "effective_event_retention_days=30",
                "threshold_source=environment",
                "consecutive_source=settings",
                "event_retention_source=environment",
                "current_consecutive_count=3",
                "latest_version=v1.38.97",
                "slowest_stage=build",
                "slowest_ms=75000",
                "run_url=https://example.com/actions/runs/123",
                "alerted_at=2026-07-17T00:00:01Z",
            )
        ),
        encoding="utf-8",
    )

    result = read_manager_deployment_bottleneck_state(status_path, config_path)

    assert result["status"] == "alerted"
    assert result["configured_threshold_ms"] == 45_000
    assert result["effective_threshold_ms"] == 30_000
    assert result["configured_event_retention_days"] == 120
    assert result["effective_event_retention_days"] == 30
    assert result["threshold_source"] == "environment"
    assert result["consecutive_source"] == "settings"
    assert result["event_retention_source"] == "environment"
    assert result["current_consecutive_count"] == 3
    assert result["slowest_stage"] == "build"
    assert result["run_url"] is None

    status_path.write_text(
        "\n".join(
            line
            for line in status_path.read_text(encoding="utf-8").splitlines()
            if not line.endswith("_source=settings")
            and not line.endswith("_source=environment")
        ),
        encoding="utf-8",
    )
    legacy_result = read_manager_deployment_bottleneck_state(
        status_path,
        config_path,
        tmp_path / "events.jsonl",
    )
    assert legacy_result["threshold_source"] == "environment"
    assert legacy_result["consecutive_source"] == "environment"
    assert legacy_result["event_retention_source"] == "environment"


def test_bottleneck_events_return_recent_valid_transitions(tmp_path: Path):
    events_path = tmp_path / "bottleneck.events.jsonl"
    events_path.write_text(
        "\n".join(
            (
                '{"event":"alerted","occurred_at":"2026-07-17T00:00:00Z",'
                '"threshold_ms":60000,"required_consecutive_count":3,'
                '"current_consecutive_count":3,"latest_version":"v1.38.98",'
                '"slowest_stage":"build","slowest_ms":75000,'
                '"run_url":"https://github.com/hanawa07/traefik-manager/actions/runs/123"}',
                "not-json",
                '{"event":[],"occurred_at":"2026-07-17T00:30:00Z"}',
                '{"event":"cleared","occurred_at":"2026-07-17T01:00:00Z",'
                '"threshold_ms":60000,"required_consecutive_count":3,'
                '"current_consecutive_count":0,"latest_version":"",'
                '"slowest_stage":"","slowest_ms":0,'
                '"run_url":"https://example.com/actions/runs/123"}',
            )
        ),
        encoding="utf-8",
    )

    events = read_manager_deployment_bottleneck_events(events_path)

    assert [event["event"] for event in events] == ["cleared", "alerted"]
    assert events[0]["run_url"] is None
    assert events[1]["latest_version"] == "v1.38.98"
    assert events[1]["current_consecutive_count"] == 3
    assert events[1]["slowest_ms"] == 75_000

    state = read_manager_deployment_bottleneck_state(
        tmp_path / "missing.status",
        tmp_path / "missing.conf",
        events_path,
    )
    assert state["retained_event_count"] == 2
    assert state["oldest_event_at"] == "2026-07-17T00:00:00Z"
    assert state["newest_event_at"] == "2026-07-17T01:00:00Z"


def test_bottleneck_event_cleanup_applies_retention_and_count_limit(tmp_path: Path):
    events_path = tmp_path / "runtime" / "bottleneck.events.jsonl"
    events_path.parent.mkdir()
    events = [
        {"event": "alerted", "occurred_at": "2026-06-01T00:00:00Z"},
        *[
            {"event": "cleared", "occurred_at": f"2026-07-17T00:{index % 60:02d}:00Z"}
            for index in range(102)
        ],
    ]
    events_path.write_text(
        "\n".join(json.dumps(event) for event in events),
        encoding="utf-8",
    )

    original = events_path.read_text(encoding="utf-8")
    preview = preview_manager_deployment_bottleneck_event_cleanup(
        7,
        events_path,
        now=datetime(2026, 7, 18),
    )

    assert preview["retention_days"] == 7
    assert preview["deleted_count"] == 3
    assert preview["retained_event_count"] == 100
    assert events_path.read_text(encoding="utf-8") == original

    result = prune_manager_deployment_bottleneck_events(
        7,
        events_path,
        now=datetime(2026, 7, 18),
    )

    assert result == preview
    assert len(events_path.read_text(encoding="utf-8").splitlines()) == 100
    assert events_path.stat().st_mode & 0o777 == 0o644
