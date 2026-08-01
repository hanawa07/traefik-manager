from pathlib import Path

from app.core.config import settings
from app.infrastructure.manager_deployment_history_archive import (
    MAX_ARCHIVE_ENTRIES,
    read_archive_entries_with_summary,
)
from app.infrastructure.manager_deployment_history_records import (
    normalize_history_lines,
    read_history_lines,
)

MAX_HISTORY_BYTES = 64 * 1024
MAX_HISTORY_ENTRIES = 20


def read_manager_deployment_history(
    path: str | Path | None = None,
    *,
    limit: int = MAX_HISTORY_ENTRIES,
) -> list[dict[str, object]]:
    history_path = Path(path or settings.MANAGER_DEPLOYMENT_HISTORY_PATH)
    try:
        lines = read_history_lines(history_path, MAX_HISTORY_BYTES)
    except OSError:
        return []
    return normalize_history_lines(reversed(lines), limit)


def read_manager_deployment_history_archive(
    path: str | Path | None = None,
    *,
    limit: int = MAX_ARCHIVE_ENTRIES,
) -> list[dict[str, object]]:
    entries, _ = read_manager_deployment_history_archive_with_summary(
        path,
        limit=limit,
    )
    return entries


def read_manager_deployment_history_archive_with_summary(
    path: str | Path | None = None,
    *,
    limit: int = MAX_ARCHIVE_ENTRIES,
) -> tuple[list[dict[str, object]], dict[str, object]]:
    history_path = Path(path or settings.MANAGER_DEPLOYMENT_HISTORY_PATH)
    return read_archive_entries_with_summary(history_path, limit=limit)
