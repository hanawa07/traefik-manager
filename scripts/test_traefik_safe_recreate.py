#!/usr/bin/env python3
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import call, patch

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

import traefik_recreate_checkpoint as checkpoint  # noqa: E402
import traefik_safe_recreate as safe_recreate  # noqa: E402
import traefik_update_runtime as runtime  # noqa: E402
from traefik_update_models import RunnerConfig, ValidationError  # noqa: E402

VERSION = "v3.7.11"
IMAGE = f"traefik:{VERSION}"
CONFIG_HASH = "a" * 64


def make_config(root: Path) -> RunnerConfig:
    compose_dir = root / "traefik"
    state_dir = root / "state"
    compose_dir.mkdir()
    state_dir.mkdir()
    compose_file = compose_dir / "compose.yml"
    compose_file.write_text("services:\n  traefik:\n    image: traefik:v3.7.11\n", encoding="utf-8")
    os.chmod(compose_file, 0o640)
    acme_file = compose_dir / "acme.json"
    acme_file.write_text("{}\n", encoding="utf-8")
    return RunnerConfig(
        state_dir=state_dir,
        request_dir=state_dir / "requests",
        compose_dir=compose_dir,
        compose_files=(compose_file,),
        acme_file=acme_file,
        service="traefik",
        container="traefik",
        network="proxy_net",
        manager_health_url="https://manager.example.com/api/health",
        recreate_guard_seconds=0,
        docker_bin="docker",
        curl_bin="curl",
    )


class CheckpointTests(unittest.TestCase):
    def test_checkpoint_round_trip_and_tamper_rejection(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            config = make_config(Path(temporary))

            def inspect(_config: RunnerConfig, template: str) -> str:
                return IMAGE if template == "{{.Config.Image}}" else CONFIG_HASH

            with (
                patch.object(checkpoint, "_docker_inspect", side_effect=inspect),
                patch.object(checkpoint, "_run", return_value=f"traefik {CONFIG_HASH}"),
            ):
                checkpoint.save_runtime_checkpoint(config, VERSION)
                saved = checkpoint.load_runtime_checkpoint(config)
                self.assertIsNotNone(saved)
                config.compose_files[0].write_text("broken\n", encoding="utf-8")
                checkpoint.restore_runtime_checkpoint(config, saved or {})
                self.assertIn("traefik:v3.7.11", config.compose_files[0].read_text())
                checkpoint_root = config.state_dir / "traefik-safe-recreate-checkpoints"
                backup = next(checkpoint_root.rglob("*.yml"))
                backup.write_text("tampered\n", encoding="utf-8")
                with self.assertRaisesRegex(ValueError, "변경되었습니다"):
                    checkpoint.load_runtime_checkpoint(config)

    def test_checkpoint_bootstrap_rejects_changed_compose(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            config = make_config(Path(temporary))
            with (
                patch.object(checkpoint, "current_container_config_hash", return_value=CONFIG_HASH),
                patch.object(checkpoint, "compose_config_hash", return_value="b" * 64),
            ):
                with self.assertRaisesRegex(ValueError, "실행 중인 Traefik과 달라"):
                    checkpoint.ensure_runtime_checkpoint(config, VERSION)


class SafeRecreateTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.config = make_config(Path(self.temporary.name))
        self.saved = {"version": VERSION}

    def test_success_updates_checkpoint(self) -> None:
        with (
            patch.object(safe_recreate, "_required_current_version", return_value=VERSION),
            patch.object(safe_recreate, "_validate_runtime") as validate,
            patch.object(safe_recreate, "ensure_runtime_checkpoint", return_value=self.saved),
            patch.object(safe_recreate, "safe_current_container_id", return_value="old"),
            patch.object(safe_recreate, "_run_compose") as run_compose,
            patch.object(safe_recreate, "_require_runtime_compose_match"),
            patch.object(safe_recreate, "_record_recreation", return_value=None),
            patch.object(safe_recreate, "save_runtime_checkpoint") as save,
            patch.object(safe_recreate, "write_heartbeat"),
        ):
            result = safe_recreate.perform_recreate(self.config, True, "tester")
        self.assertEqual(result, "success")
        self.assertEqual(validate.call_count, 2)
        run_compose.assert_called_once_with(self.config, "up", "-d", "--force-recreate")
        save.assert_called_once_with(self.config, VERSION)

    def test_failed_candidate_restores_checkpoint(self) -> None:
        validation_error = ValidationError("candidate failed", [])
        with (
            patch.object(safe_recreate, "_required_current_version", return_value=VERSION),
            patch.object(
                safe_recreate,
                "_validate_runtime",
                side_effect=[None, validation_error, None],
            ),
            patch.object(safe_recreate, "ensure_runtime_checkpoint", return_value=self.saved),
            patch.object(
                safe_recreate,
                "safe_current_container_id",
                side_effect=["old", "failed", "failed"],
            ),
            patch.object(safe_recreate, "_run_compose") as run_compose,
            patch.object(safe_recreate, "_require_runtime_compose_match"),
            patch.object(safe_recreate, "_record_recreation", return_value=None),
            patch.object(safe_recreate, "restore_runtime_checkpoint") as restore,
            patch.object(safe_recreate, "write_heartbeat"),
            patch.object(safe_recreate, "_request_failure_alert") as alert,
        ):
            result = safe_recreate.perform_recreate(self.config, False, "tester")
        self.assertEqual(result, "rolled_back")
        self.assertEqual(
            run_compose.call_args_list,
            [
                call(self.config, "up", "-d"),
                call(self.config, "up", "-d", "--force-recreate"),
            ],
        )
        restore.assert_called_once_with(self.config, self.saved)
        alert.assert_not_called()

    def test_failed_recovery_requests_alert(self) -> None:
        candidate_error = ValidationError("candidate failed", [])
        rollback_error = ValidationError("rollback failed", [])
        with (
            patch.object(safe_recreate, "_required_current_version", return_value=VERSION),
            patch.object(
                safe_recreate,
                "_validate_runtime",
                side_effect=[None, candidate_error, rollback_error],
            ),
            patch.object(safe_recreate, "ensure_runtime_checkpoint", return_value=self.saved),
            patch.object(
                safe_recreate,
                "safe_current_container_id",
                side_effect=["old", "failed", "failed"],
            ),
            patch.object(safe_recreate, "_run_compose"),
            patch.object(safe_recreate, "_record_recreation", return_value=None),
            patch.object(safe_recreate, "restore_runtime_checkpoint"),
            patch.object(safe_recreate, "_request_failure_alert", return_value="alerted") as alert,
            patch.object(safe_recreate, "write_heartbeat"),
        ):
            result = safe_recreate.perform_recreate(self.config, False, "tester")
        self.assertEqual(result, "rollback_failed")
        alert.assert_called_once_with(candidate_error, rollback_error)

    def test_recovered_runtime_is_not_failed_by_heartbeat_error(self) -> None:
        candidate_error = ValidationError("candidate failed", [])
        with (
            patch.object(safe_recreate, "_required_current_version", return_value=VERSION),
            patch.object(
                safe_recreate,
                "_validate_runtime",
                side_effect=[None, candidate_error, None],
            ),
            patch.object(safe_recreate, "ensure_runtime_checkpoint", return_value=self.saved),
            patch.object(
                safe_recreate,
                "safe_current_container_id",
                side_effect=["old", "failed", "failed"],
            ),
            patch.object(safe_recreate, "_run_compose"),
            patch.object(safe_recreate, "_require_runtime_compose_match"),
            patch.object(safe_recreate, "_record_recreation", return_value=None),
            patch.object(safe_recreate, "restore_runtime_checkpoint"),
            patch.object(safe_recreate, "write_heartbeat", side_effect=OSError("read only")),
            patch.object(safe_recreate, "_request_failure_alert") as alert,
        ):
            result = safe_recreate.perform_recreate(self.config, False, "tester")
        self.assertEqual(result, "rolled_back")
        alert.assert_not_called()

    def test_successful_runtime_reports_checkpoint_write_failure(self) -> None:
        with (
            patch.object(safe_recreate, "_required_current_version", return_value=VERSION),
            patch.object(safe_recreate, "_validate_runtime"),
            patch.object(safe_recreate, "ensure_runtime_checkpoint", return_value=self.saved),
            patch.object(safe_recreate, "safe_current_container_id", return_value="old"),
            patch.object(safe_recreate, "_run_compose"),
            patch.object(safe_recreate, "_require_runtime_compose_match"),
            patch.object(safe_recreate, "_record_recreation", return_value=None),
            patch.object(
                safe_recreate,
                "save_runtime_checkpoint",
                side_effect=OSError("read only"),
            ),
            patch.object(safe_recreate, "write_heartbeat") as heartbeat,
            patch.object(safe_recreate, "_request_failure_alert") as alert,
        ):
            result = safe_recreate.perform_recreate(self.config, True, "tester")
        self.assertEqual(result, "metadata_failed")
        self.assertIn("체크포인트 저장 실패", heartbeat.call_args.args[2])
        alert.assert_not_called()


class RuntimeHealthTests(unittest.TestCase):
    def test_unhealthy_container_fails_runtime_check(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            config = make_config(Path(temporary))

            def inspect(_config: RunnerConfig, template: str) -> str:
                values = {
                    "{{.State.Running}}": "true",
                    (
                        "{{if .State.Health}}{{.State.Health.Status}}"
                        "{{else}}missing{{end}}"
                    ): "unhealthy",
                    "{{json .NetworkSettings.Networks}}": '{"proxy_net":{}}',
                }
                return values[template]

            with (
                patch.object(runtime, "_safe_inspect", side_effect=inspect),
                patch.object(runtime, "_safe_current_version", return_value=VERSION),
                patch.object(runtime, "_run_health_check", return_value=True),
            ):
                checks = runtime._runtime_checks(config, VERSION)
        health = next(check for check in checks if check["key"] == "container_health")
        self.assertEqual(health["status"], "fail")


if __name__ == "__main__":
    unittest.main()
