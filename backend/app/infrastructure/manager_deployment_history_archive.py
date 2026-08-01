from pathlib import Path

from app.infrastructure.manager_deployment_history_daily import (
    select_daily_archive_entries,
)
from app.infrastructure.manager_deployment_history_records import (
    completed_at_day,
    completed_at_timestamp,
    normalize_history_lines,
    read_history_lines,
)

MAX_ARCHIVE_BYTES = 1024 * 1024
MAX_ARCHIVE_ENTRIES = 120
MAX_DETAILED_ARCHIVE_ENTRIES = 20


def read_archive_entries_with_summary(
    history_path: Path,
    *,
    limit: int,
) -> tuple[list[dict[str, object]], dict[str, object]]:
    if limit <= 0:
        return [], _archive_summary([], 0, 0)

    current_lines = _read_unique_lines(history_path)
    detailed_lines = _read_unique_lines(Path(f"{history_path}.1"))
    daily_lines = _read_unique_lines(Path(f"{history_path}.daily"))

    current_entries = normalize_history_lines(current_lines, len(current_lines))
    detailed_entries = _select_detailed_entries(
        detailed_lines - current_lines,
        limit=limit,
    )
    covered_days = {
        completed_at_day(entry) for entry in [*current_entries, *detailed_entries]
    }
    daily_entries = select_daily_archive_entries(
        daily_lines - current_lines,
        covered_days=covered_days,
        limit=max(0, limit - len(detailed_entries)),
    )

    entries = [
        *({**entry, "archive_sample": "detailed"} for entry in detailed_entries),
        *({**entry, "archive_sample": "daily"} for entry in daily_entries),
    ]
    entries.sort(key=completed_at_timestamp, reverse=True)
    return entries, _archive_summary(
        entries,
        len(detailed_entries),
        len(daily_entries),
    )


def _read_unique_lines(path: Path) -> set[str]:
    try:
        return set(read_history_lines(path, MAX_ARCHIVE_BYTES))
    except OSError:
        return set()


def _select_detailed_entries(
    lines: set[str],
    *,
    limit: int,
) -> list[dict[str, object]]:
    entries = normalize_history_lines(lines, len(lines))
    entries.sort(key=completed_at_timestamp, reverse=True)
    return entries[: min(MAX_DETAILED_ARCHIVE_ENTRIES, limit)]


def _archive_summary(
    entries: list[dict[str, object]],
    detailed_count: int,
    daily_count: int,
) -> dict[str, object]:
    return {
        "detailed_count": detailed_count,
        "daily_count": daily_count,
        "newest_at": entries[0]["completed_at"] if entries else None,
        "oldest_at": entries[-1]["completed_at"] if entries else None,
    }
