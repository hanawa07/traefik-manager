from datetime import datetime, timedelta
from functools import lru_cache
from zoneinfo import available_timezones


DEFAULT_DISPLAY_TIMEZONE = "Asia/Seoul"


def normalize_display_timezone(value: str | None) -> str:
    normalized = (value or "").strip()
    if normalized in get_available_timezones():
        return normalized
    return DEFAULT_DISPLAY_TIMEZONE


def get_display_timezone_name(value: str | None) -> str:
    return normalize_display_timezone(value)


def get_display_timezone_label(value: str | None) -> str:
    normalized = normalize_display_timezone(value)
    if normalized == "UTC":
        return "UTC"
    return normalized


def get_server_time_context() -> dict[str, str]:
    now = datetime.now().astimezone()
    server_timezone_name = getattr(now.tzinfo, "key", None) or now.tzname() or "Local"

    return {
        "storage_timezone": "UTC",
        "server_timezone_name": server_timezone_name,
        "server_timezone_label": server_timezone_name,
        "server_timezone_offset": _format_offset(now.utcoffset()),
        "server_time_iso": now.isoformat(timespec="seconds"),
    }


@lru_cache(maxsize=1)
def get_available_timezones() -> frozenset[str]:
    return frozenset(available_timezones())


def _format_offset(offset: timedelta | None) -> str:
    total_seconds = int((offset or timedelta()).total_seconds())
    sign = "+" if total_seconds >= 0 else "-"
    total_seconds = abs(total_seconds)
    hours, remainder = divmod(total_seconds, 3600)
    minutes = remainder // 60
    return f"{sign}{hours:02d}:{minutes:02d}"
