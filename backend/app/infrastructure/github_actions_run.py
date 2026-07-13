import asyncio
import re
from datetime import datetime, timezone
from typing import Any

import httpx


_RUN_URL_RE = re.compile(
    r"^https://github\.com/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)/actions/runs/([1-9][0-9]*)/?$"
)
_ACTIVE_CACHE_SECONDS = 30
_SETTLED_CACHE_SECONDS = 600


class GitHubActionsRunStatusReader:
    """Read one public GitHub Actions run without delaying the host watchdog."""

    _cache: dict[str, tuple[datetime, dict[str, Any]]] = {}
    _lock = asyncio.Lock()

    async def get_status(self, run_url: str | None) -> dict[str, Any]:
        api_url = build_actions_run_api_url(run_url)
        if not api_url:
            return _empty_status(None)

        now = datetime.now(timezone.utc)
        cached = self._cache.get(api_url)
        if _is_cache_fresh(cached, now):
            return cached[1].copy()

        async with self._lock:
            cached = self._cache.get(api_url)
            if _is_cache_fresh(cached, now):
                return cached[1].copy()

            status = await self._fetch_status(api_url)
            GitHubActionsRunStatusReader._cache[api_url] = (now, status.copy())
            return status

    async def _fetch_status(self, api_url: str) -> dict[str, Any]:
        checked_at = datetime.now(timezone.utc)
        try:
            async with httpx.AsyncClient(
                timeout=4.0,
                headers={
                    "Accept": "application/vnd.github+json",
                    "User-Agent": "traefik-manager",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
            ) as client:
                response = await client.get(api_url)
                response.raise_for_status()
                payload = response.json()
        except (httpx.HTTPError, ValueError, TypeError):
            return _empty_status("GitHub 알림 실행 결과를 확인하지 못했습니다", checked_at)

        if not isinstance(payload, dict):
            return _empty_status("GitHub 알림 실행 응답을 해석하지 못했습니다", checked_at)
        return {
            "external_watchdog_last_alert_run_status": _clean_text(payload.get("status")),
            "external_watchdog_last_alert_run_conclusion": _clean_text(payload.get("conclusion")),
            "external_watchdog_last_alert_run_checked_at": checked_at,
            "external_watchdog_last_alert_run_error": None,
        }


def build_actions_run_api_url(run_url: str | None) -> str | None:
    match = _RUN_URL_RE.fullmatch(str(run_url or "").strip())
    if not match:
        return None
    owner, repository, run_id = match.groups()
    return f"https://api.github.com/repos/{owner}/{repository}/actions/runs/{run_id}"


def _clean_text(value: object) -> str | None:
    text = str(value).strip() if value is not None else ""
    return text or None


def _is_cache_fresh(
    cached: tuple[datetime, dict[str, Any]] | None,
    now: datetime,
) -> bool:
    if not cached:
        return False
    status = cached[1].get("external_watchdog_last_alert_run_status")
    max_age = _ACTIVE_CACHE_SECONDS if status and status != "completed" else _SETTLED_CACHE_SECONDS
    return (now - cached[0]).total_seconds() < max_age


def _empty_status(error: str | None, checked_at: datetime | None = None) -> dict[str, Any]:
    return {
        "external_watchdog_last_alert_run_status": None,
        "external_watchdog_last_alert_run_conclusion": None,
        "external_watchdog_last_alert_run_checked_at": checked_at,
        "external_watchdog_last_alert_run_error": error,
    }
