import json
import logging
import re
import sys
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from app.core.manager_http_request_log import create_manager_http_request_log_handler

if TYPE_CHECKING:
    from fastapi import Request

_RESERVED_LOG_RECORD_FIELDS = frozenset(logging.makeLogRecord({}).__dict__.keys()) | {
    "message",
    "asctime",
    "color_message",
}
_LOGGING_CONFIGURED = False
_TELEGRAM_BOT_TOKEN_PATTERN = re.compile(r"(https://api\.telegram\.org/bot)[^/\s\"']+")


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


def is_logging_exempt_path(path: str) -> bool:
    return path in ("/api/health", "/api/v1/auth/verify")


def get_client_ip(request: Any) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "-"


def setup_logging() -> None:
    global _LOGGING_CONFIGURED

    if _LOGGING_CONFIGURED:
        return

    from app.core.config import settings

    log_level = _resolve_log_level(settings.LOG_LEVEL)
    handler = logging.StreamHandler(sys.stdout)
    if settings.APP_ENV == "production":
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(TextFormatter())

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.setLevel(log_level)
    root_logger.addHandler(handler)

    request_logger = logging.getLogger("app.request")
    request_logger.handlers.clear()
    request_logger.setLevel(log_level)
    request_logger.propagate = True
    try:
        request_handler = create_manager_http_request_log_handler(
            settings.TRAEFIK_MANAGER_REQUEST_LOG_PATH
        )
    except OSError:
        logging.getLogger(__name__).warning("Manager API 요청 영속 로그를 열지 못했습니다")
    else:
        request_handler.setLevel(log_level)
        request_handler.setFormatter(JsonFormatter())
        request_logger.addHandler(request_handler)

    for logger_name in ("uvicorn", "uvicorn.error", "fastapi"):
        logger = logging.getLogger(logger_name)
        logger.handlers.clear()
        logger.setLevel(log_level)
        logger.propagate = True

    access_logger = logging.getLogger("uvicorn.access")
    access_logger.handlers.clear()
    access_logger.propagate = False
    access_logger.disabled = True

    _LOGGING_CONFIGURED = True


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "time": _format_timestamp(record.created),
            "level": record.levelname,
        }
        message = redact_sensitive_log_value(record.getMessage())
        if message:
            payload["message"] = message
        payload.update(_collect_extra_fields(record))
        if record.exc_info:
            payload["exc"] = redact_sensitive_log_value(self.formatException(record.exc_info))
        return json.dumps(payload, ensure_ascii=False)


class TextFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        message = (
            f"{_format_timestamp(record.created)} {record.levelname:<5} "
            f"[{record.name}] {redact_sensitive_log_value(record.getMessage())}"
        )
        extra_fields = _collect_extra_fields(record)
        if extra_fields:
            message = f"{message} {_format_text_extra_fields(extra_fields)}"
        if record.exc_info:
            message = f"{message}\n{redact_sensitive_log_value(self.formatException(record.exc_info))}"
        return message


def redact_sensitive_log_value(value: str) -> str:
    return _TELEGRAM_BOT_TOKEN_PATTERN.sub(r"\1<redacted>", value)


def _resolve_log_level(raw_level: str) -> int:
    return getattr(logging, raw_level.upper(), logging.INFO)


def _format_timestamp(created_at: float) -> str:
    return datetime.fromtimestamp(created_at, tz=timezone.utc).isoformat(timespec="milliseconds").replace(
        "+00:00",
        "Z",
    )


def _collect_extra_fields(record: logging.LogRecord) -> dict[str, object]:
    payload: dict[str, object] = {}
    for key, value in record.__dict__.items():
        if key in _RESERVED_LOG_RECORD_FIELDS:
            continue
        payload[key] = _normalize_value(value)
    return payload


def _normalize_value(value):
    if isinstance(value, (str, int, float, bool)) or value is None:
        return redact_sensitive_log_value(value) if isinstance(value, str) else value
    if isinstance(value, (list, tuple)):
        return [_normalize_value(item) for item in value]
    if isinstance(value, dict):
        return {str(key): _normalize_value(item) for key, item in value.items()}
    return str(value)


def _format_text_extra_fields(payload: dict[str, object]) -> str:
    parts: list[str] = []
    for key, value in payload.items():
        if isinstance(value, float):
            normalized = f"{value:.2f}"
        elif isinstance(value, (dict, list)):
            normalized = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        else:
            normalized = str(value)
        parts.append(f"{key}={normalized}")
    return " ".join(parts)
