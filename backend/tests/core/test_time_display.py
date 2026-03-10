from datetime import datetime

from app.core.time_display import (
    get_display_timezone_name,
    get_server_time_context,
    normalize_display_timezone,
)


def test_normalize_display_timezone_defaults_to_asia_seoul():
    assert normalize_display_timezone(None) == "Asia/Seoul"
    assert normalize_display_timezone("") == "Asia/Seoul"
    assert normalize_display_timezone("invalid") == "Asia/Seoul"


def test_get_display_timezone_name_accepts_iana_timezones():
    assert get_display_timezone_name("UTC") == "UTC"
    assert get_display_timezone_name("Asia/Seoul") == "Asia/Seoul"
    assert get_display_timezone_name("America/New_York") == "America/New_York"


def test_get_server_time_context_returns_timezone_aware_values():
    context = get_server_time_context()

    assert context["storage_timezone"] == "UTC"
    assert context["server_timezone_label"]
    assert context["server_timezone_offset"].startswith(("+", "-"))

    parsed = datetime.fromisoformat(context["server_time_iso"])
    assert parsed.tzinfo is not None
