import asyncio
import re
from datetime import datetime, timezone
from typing import Any

import httpx


_RUN_URL_RE = re.compile(
    r"^https://github\.com/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)/actions/runs/([1-9][0-9]*)/?$"
)
_ACTIVE_CACHE_SECONDS = 30
_ERROR_CACHE_SECONDS = 600
_SETTLED_CACHE_SECONDS = 3600


class GitHubActionsRunStatusReader:
    """Read one public GitHub Actions run without delaying the host watchdog."""

    _cache: dict[str, tuple[datetime, dict[str, Any]]] = {}
    _locks: dict[str, asyncio.Lock] = {}

    async def get_statuses(self, run_urls: list[str]) -> dict[str, dict[str, Any]]:
        unique_urls = list(dict.fromkeys(run_urls))
        results = await asyncio.gather(*(self.get_status(run_url) for run_url in unique_urls))
        return dict(zip(unique_urls, results))

    async def get_status(self, run_url: str | None) -> dict[str, Any]:
        api_url = build_actions_run_api_url(run_url)
        if not api_url:
            return _empty_status(None)

        now = datetime.now(timezone.utc)
        cached = self._cache.get(api_url)
        if _is_cache_fresh(cached, now):
            return cached[1].copy()

        lock = self._locks.setdefault(api_url, asyncio.Lock())
        async with lock:
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
    if status == "completed":
        max_age = _SETTLED_CACHE_SECONDS
    elif status:
        max_age = _ACTIVE_CACHE_SECONDS
    else:
        max_age = _ERROR_CACHE_SECONDS
    return (now - cached[0]).total_seconds() < max_age


def _empty_status(error: str | None, checked_at: datetime | None = None) -> dict[str, Any]:
    return {
        "external_watchdog_last_alert_run_status": None,
        "external_watchdog_last_alert_run_conclusion": None,
        "external_watchdog_last_alert_run_checked_at": checked_at,
        "external_watchdog_last_alert_run_error": error,
    }
