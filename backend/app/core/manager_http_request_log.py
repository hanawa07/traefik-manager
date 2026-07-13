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
    chunks: list[str] = []
    found = False
    for candidate in _request_log_paths(target):
        try:
            if not candidate.is_file():
                continue
            chunks.append(candidate.read_text(encoding="utf-8", errors="ignore").rstrip("\n"))
            found = True
        except OSError:
            continue
    return "\n".join(chunks) if found else None


def get_manager_http_request_log_status(path: str) -> dict[str, int]:
    target = Path(path)
    size_bytes = 0
    file_count = 0
    rotated_file_count = 0
    for candidate in _request_log_paths(target):
        try:
            if not candidate.is_file():
                continue
            size_bytes += candidate.stat().st_size
            file_count += 1
            rotated_file_count += candidate != target
        except OSError:
            continue
    return {
        "size_bytes": size_bytes,
        "capacity_bytes": MANAGER_HTTP_REQUEST_LOG_MAX_BYTES
        * (MANAGER_HTTP_REQUEST_LOG_BACKUP_COUNT + 1),
        "file_count": file_count,
        "max_file_count": MANAGER_HTTP_REQUEST_LOG_BACKUP_COUNT + 1,
        "rotated_file_count": rotated_file_count,
    }


def _request_log_paths(target: Path) -> list[Path]:
    return [
        *(
            Path(f"{target}.{index}")
            for index in range(MANAGER_HTTP_REQUEST_LOG_BACKUP_COUNT, 0, -1)
        ),
        target,
    ]
