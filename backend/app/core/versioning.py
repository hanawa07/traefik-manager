import re


SEMVER_RE = re.compile(r"v?(\d+)\.(\d+)\.(\d+)")


def compare_versions(current_version: str | None, latest_version: str | None) -> int | None:
    current = parse_version(current_version)
    latest = parse_version(latest_version)
    if current is None or latest is None:
        return None
    if current == latest:
        return 0
    return -1 if current < latest else 1


def parse_version(value: str | None) -> tuple[int, int, int] | None:
    if not isinstance(value, str):
        return None
    match = SEMVER_RE.search(value)
    if not match:
        return None
    return tuple(int(part) for part in match.groups())
