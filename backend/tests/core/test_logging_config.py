import ast
import json
import logging
import unittest
from pathlib import Path

from app.core.logging_config import JsonFormatter, is_logging_exempt_path


class LoggingConfigTest(unittest.TestCase):
    def test_json_formatter_includes_extra_fields(self):
        formatter = JsonFormatter()
        record = logging.LogRecord(
            name="app.request",
            level=logging.INFO,
            pathname=__file__,
            lineno=10,
            msg="요청 완료",
            args=(),
            exc_info=None,
        )
        record.method = "POST"
        record.path = "/api/v1/services"
        record.status_code = 201
        record.duration_ms = 12.5
        record.client_ip = "127.0.0.1"

        payload = json.loads(formatter.format(record))

        self.assertEqual(payload["level"], "INFO")
        self.assertEqual(payload["message"], "요청 완료")
        self.assertEqual(payload["method"], "POST")
        self.assertEqual(payload["path"], "/api/v1/services")
        self.assertEqual(payload["status_code"], 201)
        self.assertEqual(payload["duration_ms"], 12.5)
        self.assertEqual(payload["client_ip"], "127.0.0.1")
        self.assertIn("time", payload)

    def test_is_logging_exempt_path_skips_health_only(self):
        self.assertTrue(is_logging_exempt_path("/api/health"))
        self.assertFalse(is_logging_exempt_path("/api/v1/services"))

    def test_main_calls_setup_logging_inside_lifespan_only(self):
        backend_root = Path(__file__).resolve().parents[2]
        source = (backend_root / "app" / "main.py").read_text(encoding="utf-8")
        module = ast.parse(source)

        top_level_setup_calls = [
            node
            for node in module.body
            if isinstance(node, ast.Expr)
            and isinstance(node.value, ast.Call)
            and isinstance(node.value.func, ast.Name)
            and node.value.func.id == "setup_logging"
        ]
        self.assertEqual(top_level_setup_calls, [])

        lifespan = next(
            node
            for node in module.body
            if isinstance(node, ast.AsyncFunctionDef) and node.name == "lifespan"
        )
        self.assertTrue(
            any(
                isinstance(node, ast.Call)
                and isinstance(node.func, ast.Name)
                and node.func.id == "setup_logging"
                for node in ast.walk(lifespan)
            )
        )
