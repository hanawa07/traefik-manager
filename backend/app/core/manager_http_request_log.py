from logging.handlers import RotatingFileHandler
from pathlib import Path


MANAGER_HTTP_REQUEST_LOG_BACKUP_COUNT = 5
MANAGER_HTTP_REQUEST_LOG_MAX_BYTES = 5 * 1024 * 1024


def create_manager_http_request_log_handler(path: str) -> RotatingFileHandler:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    return RotatingFileHandler(
        target,
        maxBytes=MANAGER_HTTP_REQUEST_LOG_MAX_BYTES,
        backupCount=MANAGER_HTTP_REQUEST_LOG_BACKUP_COUNT,
        encoding="utf-8",
    )


def read_manager_http_request_logs(path: str) -> str | None:
    target = Path(path)
    paths = [
        *(Path(f"{target}.{index}") for index in range(MANAGER_HTTP_REQUEST_LOG_BACKUP_COUNT, 0, -1)),
        target,
    ]
    chunks: list[str] = []
    found = False
    for candidate in paths:
        try:
            if not candidate.is_file():
                continue
            chunks.append(candidate.read_text(encoding="utf-8", errors="ignore").rstrip("\n"))
            found = True
        except OSError:
            continue
    return "\n".join(chunks) if found else None
