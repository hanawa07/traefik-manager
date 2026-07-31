import json
import os
import tempfile
from pathlib import Path

from app.core.config import settings

MAX_EVENTS_BYTES = 128 * 1024


def resolve_events_path(path: str | Path | None) -> Path:
    return Path(
        path or f"{settings.MANAGER_DEPLOYMENT_BOTTLENECK_CONFIG_PATH}.events.jsonl"
    )


def read_event_lines(events_path: Path, *, strict: bool = False) -> list[str]:
    try:
        if events_path.stat().st_size > MAX_EVENTS_BYTES:
            if strict:
                raise ValueError("event history file is too large")
            return []
        return events_path.read_text(encoding="utf-8").splitlines()
    except FileNotFoundError:
        return []
    except (OSError, UnicodeError):
        if strict:
            raise
        return []


def write_events(events_path: Path, events: list[dict[str, object]]) -> None:
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            "w",
            dir=events_path.parent,
            encoding="utf-8",
            prefix=f".{events_path.name}.",
            delete=False,
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)
            for event in reversed(events):
                temporary_file.write(
                    json.dumps(event, ensure_ascii=False, separators=(",", ":"))
                )
                temporary_file.write("\n")
            temporary_file.flush()
            os.fsync(temporary_file.fileno())
        temporary_path.chmod(0o644)
        os.replace(temporary_path, events_path)
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
