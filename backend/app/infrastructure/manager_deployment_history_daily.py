from app.infrastructure.manager_deployment_history_records import (
    completed_at_day,
    completed_at_timestamp,
    normalize_history_lines,
)


def select_daily_archive_entries(
    lines: set[str],
    *,
    covered_days: set[str],
    limit: int,
) -> list[dict[str, object]]:
    entries = normalize_history_lines(lines, len(lines))
    entries = [
        entry for entry in entries if completed_at_day(entry) not in covered_days
    ]
    entries.sort(key=completed_at_timestamp, reverse=True)
    return entries[:limit]
