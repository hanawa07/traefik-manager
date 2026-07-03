import asyncio
import re
from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx

from app.core.config import settings
from app.core.versioning import compare_versions


class ManagerReleaseChecker:
    """GitHub 최신 릴리즈 기준으로 Manager 업데이트 상태를 조회한다."""

    _latest_release_cache: dict[str, dict] = {}
    _latest_release_lock = asyncio.Lock()

    async def get_release_status(
        self,
        current_version: str | None,
        source_url: str | None,
        *,
        force_refresh: bool = False,
    ) -> dict:
        latest_info = await self._get_latest_release_info(source_url, force_refresh=force_refresh)
        version_comparison = compare_versions(current_version, latest_info.get("latest_version"))
        return {
            **latest_info,
            "update_available": version_comparison < 0 if version_comparison is not None else None,
        }

    async def _get_latest_release_info(self, source_url: str | None, *, force_refresh: bool = False) -> dict:
        checked_at = datetime.now(timezone.utc)
        api_url = self._resolve_api_url(source_url)
        if not api_url:
            return self._build_error_info(
                checked_at,
                "Manager 이미지 source에서 GitHub 저장소를 해석하지 못했습니다",
            )

        cache = self._latest_release_cache.get(api_url)
        if not force_refresh and cache and self._is_cache_fresh(cache, checked_at):
            return cache.copy()

        async with self._latest_release_lock:
            cache = self._latest_release_cache.get(api_url)
            if not force_refresh and cache and self._is_cache_fresh(cache, checked_at):
                return cache.copy()

            info = await self._fetch_latest_release_info(api_url, checked_at)
            ManagerReleaseChecker._latest_release_cache[api_url] = info.copy()
            return info

    def _resolve_api_url(self, source_url: str | None) -> str | None:
        configured_url = _normalize_text(settings.TRAEFIK_MANAGER_LATEST_RELEASE_API_URL)
        if configured_url:
            return configured_url
        return build_latest_release_api_url(source_url)

    def _is_cache_fresh(self, cache: dict, now: datetime) -> bool:
        checked_at = cache.get("latest_version_checked_at")
        if not isinstance(checked_at, datetime):
            return False

        max_age_seconds = max(settings.TRAEFIK_MANAGER_LATEST_RELEASE_CACHE_SECONDS, 60)
        return (now - checked_at).total_seconds() < max_age_seconds

    async def _fetch_latest_release_info(self, api_url: str, checked_at: datetime) -> dict:
        try:
            async with httpx.AsyncClient(
                timeout=settings.TRAEFIK_MANAGER_LATEST_RELEASE_TIMEOUT_SECONDS,
                headers={
                    "Accept": "application/vnd.github+json",
                    "User-Agent": "traefik-manager",
                },
            ) as client:
                response = await client.get(api_url)
                if response.status_code == 404:
                    return self._build_error_info(checked_at, "GitHub 최신 릴리즈가 없습니다")
                response.raise_for_status()
                payload = response.json()
        except (httpx.HTTPError, ValueError):
            return self._build_error_info(checked_at, "Manager 최신 릴리즈를 확인하지 못했습니다")

        latest_version = payload.get("tag_name") if isinstance(payload, dict) else None
        if not isinstance(latest_version, str) or not latest_version.strip():
            return self._build_error_info(checked_at, "Manager 최신 릴리즈 응답을 해석하지 못했습니다")

        latest_release_url = payload.get("html_url") if isinstance(payload, dict) else None
        return {
            "latest_version": latest_version.strip(),
            "latest_release_url": _normalize_text(latest_release_url),
            "latest_version_checked_at": checked_at,
            "latest_version_error": None,
        }

    def _build_error_info(self, checked_at: datetime, message: str) -> dict:
        return {
            "latest_version": None,
            "latest_release_url": None,
            "latest_version_checked_at": checked_at,
            "latest_version_error": message,
        }


def build_latest_release_api_url(source_url: str | None) -> str | None:
    normalized = _normalize_text(source_url)
    if not normalized:
        return None

    ssh_match = re.match(r"^git@github\.com:([^/]+)/(.+?)(?:\.git)?$", normalized)
    if ssh_match:
        return _build_github_latest_release_url(ssh_match.group(1), ssh_match.group(2))

    parsed = urlparse(normalized)
    if parsed.netloc.lower() not in {"github.com", "www.github.com"}:
        return None

    parts = [part for part in parsed.path.strip("/").split("/") if part]
    if len(parts) < 2:
        return None

    owner = parts[0]
    repo = parts[1].removesuffix(".git")
    return _build_github_latest_release_url(owner, repo)


def _build_github_latest_release_url(owner: str, repo: str) -> str | None:
    owner = owner.strip()
    repo = repo.strip()
    if not owner or not repo:
        return None
    return f"https://api.github.com/repos/{owner}/{repo}/releases/latest"


def _normalize_text(value: object) -> str | None:
    text = str(value).strip() if value is not None else ""
    if not text or text.lower() == "unknown":
        return None
    return text
