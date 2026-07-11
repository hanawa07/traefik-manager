import re
from datetime import datetime, timezone
from pathlib import Path

ANSI_ESCAPE_PATTERN = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")


def read_smoke_rotation_log_tail(
    path: str,
    *,
    max_bytes: int = 32_768,
    max_lines: int = 12,
) -> tuple[list[str], str | None]:
    log_path = Path(path)
    try:
        stat = log_path.stat()
        with log_path.open("rb") as log_file:
            log_file.seek(0, 2)
            size = log_file.tell()
            start = max(0, size - max_bytes)
            log_file.seek(start)
            raw = log_file.read()
    except OSError:
        return [], None

    lines = raw.decode("utf-8", errors="replace").splitlines()
    if start > 0 and lines:
        lines = lines[1:]
    sanitized = [ANSI_ESCAPE_PATTERN.sub("", line)[-500:] for line in lines[-max_lines:]]
    updated_at = datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat()
    return sanitized, updated_at
