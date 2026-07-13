import json
import logging

from app.core.logging_config import JsonFormatter
from app.core.manager_http_request_log import (
    create_manager_http_request_log_handler,
    get_manager_http_request_log_status,
    read_manager_http_request_logs,
)


def test_request_log_handler_writes_json_and_reader_keeps_rotation_order(tmp_path):
    target = tmp_path / "manager-http-requests.jsonl"
    target.with_name(f"{target.name}.2").write_text("oldest\n", encoding="utf-8")
    target.with_name(f"{target.name}.1").write_text("older\n", encoding="utf-8")

    handler = create_manager_http_request_log_handler(str(target))
    handler.setFormatter(JsonFormatter())
    record = logging.LogRecord(
        name="app.request",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="요청 완료",
        args=(),
        exc_info=None,
    )
    record.path = "/api/v1/services"
    record.status_code = 404
    handler.emit(record)
    handler.close()

    lines = read_manager_http_request_logs(str(target)).splitlines()
    assert lines[:2] == ["oldest", "older"]
    assert json.loads(lines[2])["status_code"] == 404
    status = get_manager_http_request_log_status(str(target))
    assert status["file_count"] == 3
    assert status["max_file_count"] == 6
    assert status["rotated_file_count"] == 2
    assert status["size_bytes"] > 0
    assert status["capacity_bytes"] == 30 * 1024 * 1024


def test_request_log_reader_returns_none_without_files(tmp_path):
    target = str(tmp_path / "missing.jsonl")
    assert read_manager_http_request_logs(target) is None
    assert get_manager_http_request_log_status(target)["file_count"] == 0
