import asyncio
import re
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

from app.infrastructure.smoke_run_history_fetcher import (
    build_smoke_history_error,
    fetch_smoke_run_history,
)
from app.infrastructure.smoke_run_history_processing import (
    normalize_history_search,
)

_CACHE_SECONDS = 600
_MAX_CACHE_ITEMS = 200
_REPOSITORY_PART_RE = re.compile(r"^[A-Za-z0-9_.-]+$")


class GitHubSmokeRunHistoryReader:
    """Read recent smoke results from the repository's public Actions metadata."""

    _cache: dict[tuple[str, int | None, int, str, str], tuple[datetime, dict[str, Any]]] = {}
    _lock = asyncio.Lock()
    _cache_hits = 0
    _cache_misses = 0

    async def get_history(
        self,
        source_url: str | None,
        *,
        force_refresh: bool = False,
        recent_days: int | None = None,
        page: int = 1,
        search: str | None = None,
        status_filter: str = "all",
    ) -> dict[str, Any]:
        normalized_search = normalize_history_search(search)
        if status_filter not in {"all", "success", "failure"}:
            return build_smoke_history_error(
                "이력 상태 필터를 확인하지 못했습니다",
                recent_days=recent_days,
            )
        if page < 1:
            return build_smoke_history_error(
                "이력 페이지를 확인하지 못했습니다",
                recent_days=recent_days,
            )
        repository_urls = _resolve_repository_urls(source_url)
        if repository_urls is None:
            return build_smoke_history_error(
                "GitHub 저장소 주소를 확인하지 못했습니다",
                recent_days=recent_days,
                page=page,
                search=normalized_search,
                status_filter=status_filter,
            )

        api_url, public_url = repository_urls
        cache_key = (api_url, recent_days, page, normalized_search, status_filter)
        now = datetime.now(timezone.utc)
        cached = self._cache.get(cache_key)
        _prune_history_cache(now)
        if not force_refresh and cached and (now - cached[0]).total_seconds() < _CACHE_SECONDS:
            GitHubSmokeRunHistoryReader._cache_hits += 1
            return _copy_history(cached[1])

        async with self._lock:
            current = self._cache.get(cache_key)
            if current is not None:
                cached = current
            if not force_refresh and cached and (now - cached[0]).total_seconds() < _CACHE_SECONDS:
                GitHubSmokeRunHistoryReader._cache_hits += 1
                return _copy_history(cached[1])

            GitHubSmokeRunHistoryReader._cache_misses += 1
            history = await self._fetch_history(
                api_url,
                public_url,
                force_refresh=force_refresh,
                recent_days=recent_days,
                page=page,
                search=normalized_search,
                status_filter=status_filter,
            )
            history["checked_at"] = datetime.now(timezone.utc).isoformat()
            if history["error"] and cached and cached[1]["runs"]:
                history["runs"] = cached[1]["runs"]
                history["latest_failure"] = cached[1]["latest_failure"]
                history["total"] = cached[1]["total"]
                history["total_pages"] = cached[1]["total_pages"]
            GitHubSmokeRunHistoryReader._cache[cache_key] = (now, _copy_history(history))
            _prune_history_cache(now)
            return history

    async def _fetch_history(
        self,
        api_url: str,
        public_url: str,
        *,
        force_refresh: bool = False,
        recent_days: int | None = None,
        page: int = 1,
        search: str = "",
        status_filter: str = "all",
    ) -> dict[str, Any]:
        return await fetch_smoke_run_history(
            api_url,
            public_url,
            force_refresh=force_refresh,
            recent_days=recent_days,
            page=page,
            search=search,
            status_filter=status_filter,
        )


def _resolve_repository_urls(source_url: str | None) -> tuple[str, str] | None:
    source = _clean_text(source_url)
    if not source:
        return None

    ssh_match = re.fullmatch(r"git@github\.com:([^/]+)/(.+?)(?:\.git)?", source)
    if ssh_match:
        owner, repository = ssh_match.groups()
        repository = repository.removesuffix(".git")
    else:
        parsed = urlparse(source)
        if parsed.netloc.lower() not in {"github.com", "www.github.com"}:
            return None
        parts = [part for part in parsed.path.strip("/").split("/") if part]
        if len(parts) < 2:
            return None
        owner, repository = parts[0], parts[1].removesuffix(".git")

    if not _REPOSITORY_PART_RE.fullmatch(owner) or not _REPOSITORY_PART_RE.fullmatch(repository):
        return None
    return (
        f"https://api.github.com/repos/{owner}/{repository}",
        f"https://github.com/{owner}/{repository}",
    )


def _clean_text(value: object) -> str | None:
    text = str(value).strip() if value is not None else ""
    return text or None


def _prune_history_cache(now: datetime) -> None:
    cache = GitHubSmokeRunHistoryReader._cache
    for key, (cached_at, _) in list(cache.items()):
        if (now - cached_at).total_seconds() >= _CACHE_SECONDS:
            cache.pop(key, None)
    overflow = len(cache) - _MAX_CACHE_ITEMS
    if overflow > 0:
        for key in sorted(cache, key=lambda item: cache[item][0])[:overflow]:
            cache.pop(key, None)


def read_smoke_history_cache_diagnostics(
    *,
    now: datetime | None = None,
) -> dict[str, int]:
    _prune_history_cache(now or datetime.now(timezone.utc))
    return {
        "items": len(GitHubSmokeRunHistoryReader._cache),
        "capacity": _MAX_CACHE_ITEMS,
        "hits": GitHubSmokeRunHistoryReader._cache_hits,
        "misses": GitHubSmokeRunHistoryReader._cache_misses,
    }


def _copy_history(history: dict[str, Any]) -> dict[str, Any]:
    return {
        "runs": [run.copy() for run in history["runs"]],
        "latest_failure": history["latest_failure"].copy()
        if history["latest_failure"]
        else None,
        "checked_at": history["checked_at"],
        "recent_days": history["recent_days"],
        "page": history["page"],
        "per_page": history["per_page"],
        "total": history["total"],
        "total_pages": history["total_pages"],
        "search": history["search"],
        "status_filter": history["status_filter"],
        "github_api_request_usage": history.get("github_api_request_usage"),
        "error": history["error"],
    }
