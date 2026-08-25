#!/usr/bin/env python3
import importlib.util
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from traefik_recreate_window import seconds_until_safe_recreate
from traefik_update_models import UpdateRequest

RUNNER_PATH = Path(__file__).with_name("traefik-update-runner.py")
SPEC = importlib.util.spec_from_file_location("traefik_update_runner_script", RUNNER_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Traefik 업데이트 실행기를 불러올 수 없습니다")
RUNNER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RUNNER)


class RecreateWindowTest(unittest.TestCase):
    def test_waits_for_two_minutes_after_quarter_hour(self) -> None:
        cases = {
            datetime(2026, 8, 25, 1, 0, 0): 120,
            datetime(2026, 8, 25, 1, 1, 59, 500000): 1,
            datetime(2026, 8, 25, 1, 13, 0): 240,
            datetime(2026, 8, 25, 1, 14, 59): 121,
            datetime(2026, 8, 25, 1, 15, 0): 120,
        }
        for now, expected in cases.items():
            with self.subTest(now=now):
                self.assertEqual(seconds_until_safe_recreate(now), expected)

    def test_allows_recreate_outside_guard_window(self) -> None:
        for now in (
            datetime(2026, 8, 25, 1, 2, 0),
            datetime(2026, 8, 25, 1, 12, 59, 999999),
            datetime(2026, 8, 25, 1, 17, 0),
        ):
            with self.subTest(now=now):
                self.assertEqual(seconds_until_safe_recreate(now), 0)

    def test_guard_can_only_use_supported_range(self) -> None:
        with self.assertRaises(ValueError):
            seconds_until_safe_recreate(guard_seconds=301)
        self.assertEqual(seconds_until_safe_recreate(guard_seconds=0), 0)

    def test_keeps_request_queued_during_guard_window(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_dir:
            request_path = Path(temporary_dir) / "traefik-update-request.json"
            request_path.write_text("{}", encoding="utf-8")
            config = SimpleNamespace(request_path=request_path, recreate_guard_seconds=120)
            request = UpdateRequest(
                "11111111-1111-4111-8111-111111111111",
                "v3.7.11",
                "self-test",
                "2026-08-25T00:00:00Z",
            )
            with (
                patch.object(RUNNER, "observe_container_recreation", return_value=None),
                patch.object(RUNNER, "read_request", return_value=request),
                patch.object(RUNNER, "seconds_until_safe_recreate", return_value=45),
                patch.object(RUNNER, "write_heartbeat") as write_heartbeat,
                patch.object(RUNNER, "process_request") as process_request,
            ):
                self.assertEqual(RUNNER._run_once(config), 0)

            self.assertTrue(request_path.exists())
            process_request.assert_not_called()
            self.assertIn("약 45초 뒤", write_heartbeat.call_args.args[2])


if __name__ == "__main__":
    unittest.main()
