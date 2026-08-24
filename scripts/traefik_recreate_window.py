#!/usr/bin/env python3
import math
import os
import sys
import time
from datetime import datetime

RECREATE_INTERVAL_SECONDS = 15 * 60
DEFAULT_GUARD_SECONDS = 2 * 60
MAX_GUARD_SECONDS = 5 * 60


def guard_seconds_from_environment() -> int:
    raw = os.environ.get(
        "TM_TRAEFIK_RECREATE_GUARD_SECONDS",
        str(DEFAULT_GUARD_SECONDS),
    )
    try:
        guard_seconds = int(raw)
    except ValueError as exc:
        raise ValueError("Traefik 재생성 보호 시간이 올바르지 않습니다") from exc
    if not 0 <= guard_seconds <= MAX_GUARD_SECONDS:
        raise ValueError("Traefik 재생성 보호 시간은 0~300초여야 합니다")
    return guard_seconds


def seconds_until_safe_recreate(
    now: datetime | None = None,
    guard_seconds: int = DEFAULT_GUARD_SECONDS,
) -> int:
    if not 0 <= guard_seconds <= MAX_GUARD_SECONDS:
        raise ValueError("Traefik 재생성 보호 시간은 0~300초여야 합니다")
    if guard_seconds == 0:
        return 0

    current = now or datetime.now()
    elapsed = current.minute * 60 + current.second + current.microsecond / 1_000_000
    offset = elapsed % RECREATE_INTERVAL_SECONDS
    if offset < guard_seconds:
        return math.ceil(guard_seconds - offset)
    if offset >= RECREATE_INTERVAL_SECONDS - guard_seconds:
        return math.ceil(RECREATE_INTERVAL_SECONDS + guard_seconds - offset)
    return 0


def main() -> int:
    try:
        wait_seconds = seconds_until_safe_recreate(
            guard_seconds=guard_seconds_from_environment()
        )
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    if wait_seconds:
        print(
            f"15분 단위 운영 점검을 피해 Traefik 재생성을 {wait_seconds}초 대기합니다"
        )
        time.sleep(wait_seconds)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
