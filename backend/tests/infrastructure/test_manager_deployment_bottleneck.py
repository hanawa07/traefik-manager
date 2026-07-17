from pathlib import Path

from app.infrastructure.manager_deployment_bottleneck import (
    read_manager_deployment_bottleneck_config,
    read_manager_deployment_bottleneck_state,
    write_manager_deployment_bottleneck_config,
)


def test_bottleneck_config_round_trip_and_invalid_value_fallback(tmp_path: Path):
    config_path = tmp_path / "runtime" / "bottleneck.conf"

    assert read_manager_deployment_bottleneck_config(config_path) == {
        "threshold_ms": 60_000,
        "consecutive_count": 3,
    }
    assert write_manager_deployment_bottleneck_config(45_000, 4, config_path) == {
        "threshold_ms": 45_000,
        "consecutive_count": 4,
    }
    assert config_path.stat().st_mode & 0o777 == 0o644

    config_path.write_text("threshold_ms=bad\nconsecutive_count=99\n", encoding="utf-8")
    assert read_manager_deployment_bottleneck_config(config_path) == {
        "threshold_ms": 60_000,
        "consecutive_count": 3,
    }


def test_bottleneck_state_reads_effective_check_and_rejects_foreign_run_url(tmp_path: Path):
    config_path = tmp_path / "bottleneck.conf"
    status_path = tmp_path / "bottleneck.status"
    write_manager_deployment_bottleneck_config(45_000, 4, config_path)
    status_path.write_text(
        "\n".join(
            (
                "status=alerted",
                "checked_at=2026-07-17T00:00:00Z",
                "effective_threshold_ms=30000",
                "effective_consecutive_count=2",
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
    assert result["current_consecutive_count"] == 3
    assert result["slowest_stage"] == "build"
    assert result["run_url"] is None
