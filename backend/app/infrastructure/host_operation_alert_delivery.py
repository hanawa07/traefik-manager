from app.infrastructure.github_actions_run import build_actions_run_api_url

ALERT_CHANNELS = {"anubis", "github"}


def normalize_alert_delivery(
    raw_channel: object,
    raw_run_url: object,
) -> tuple[str | None, str | None] | None:
    run_url = None if raw_run_url in (None, "") else raw_run_url
    if run_url is not None and (
        not isinstance(run_url, str) or not build_actions_run_api_url(run_url)
    ):
        return None

    if raw_channel in (None, ""):
        channel = "github" if run_url else None
    elif isinstance(raw_channel, str) and raw_channel in ALERT_CHANNELS:
        channel = raw_channel
    else:
        return None

    if channel == "github" and run_url is None:
        return None
    if channel == "anubis" and run_url is not None:
        return None
    return channel, run_url
