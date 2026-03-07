import ast
import json
import logging
from pathlib import Path

import pytest

from app.core.logging_config import JsonFormatter, is_logging_exempt_path

def test_json_formatter_includes_extra_fields():
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

    assert payload["level"] == "INFO"
    assert payload["message"] == "요청 완료"
    assert payload["method"] == "POST"
    assert payload["path"] == "/api/v1/services"
    assert payload["status_code"] == 201
    assert payload["duration_ms"] == 12.5
    assert payload["client_ip"] == "127.0.0.1"
    assert "time" in payload

def test_is_logging_exempt_path_skips_health_only():
    assert is_logging_exempt_path("/api/health") is True
    assert is_logging_exempt_path("/api/v1/services") is False

def test_main_calls_setup_logging_inside_lifespan_only():
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
    assert top_level_setup_calls == []

    lifespan = next(
        node
        for node in module.body
        if isinstance(node, ast.AsyncFunctionDef) and node.name == "lifespan"
    )
    has_setup_logging = any(
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == "setup_logging"
        for node in ast.walk(lifespan)
    )
    assert has_setup_logging is True