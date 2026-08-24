import asyncio
import re
from datetime import datetime, timezone

import httpx

from app.core.config import settings
from app.core.versioning import parse_version


_GHSA_PATTERN = re.compile(r"\bGHSA-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}\b", re.IGNORECASE)
_SECURITY_HEADING_PATTERN = re.compile(r"^#{1,6}\s*(?:security|cves?)\b", re.IGNORECASE | re.MULTILINE)


class TraefikReleaseChecker:
    """GitHub 릴리스 기준으로 최신 Traefik 버전을 조회한다."""

    _latest_version_cache: dict | None = None
    _latest_version_lock = asyncio.Lock()

    async def get_latest_version_info(self, *, force_refresh: bool = False) -> dict:
        checked_at = datetime.now(timezone.utc)
        cache = self._latest_version_cache
        if not force_refresh and cache and self._is_cache_fresh(cache, checked_at):
            return cache.copy()

        async with self._latest_version_lock:
            cache = self._latest_version_cache
            if not force_refresh and cache and self._is_cache_fresh(cache, checked_at):
                return cache.copy()

            info = await self._fetch_latest_version_info(checked_at)
            TraefikReleaseChecker._latest_version_cache = info.copy()
            return info

    def _is_cache_fresh(self, cache: dict, now: datetime) -> bool:
        checked_at = cache.get("latest_version_checked_at")
        if not isinstance(checked_at, datetime):
            return False

        max_age_seconds = max(settings.TRAEFIK_LATEST_VERSION_CACHE_SECONDS, 60)
        return (now - checked_at).total_seconds() < max_age_seconds

    async def _fetch_latest_version_info(self, checked_at: datetime) -> dict:
        try:
            async with httpx.AsyncClient(
                timeout=settings.TRAEFIK_LATEST_VERSION_TIMEOUT_SECONDS,
                headers={
                    "Accept": "application/vnd.github+json",
                    "User-Agent": "traefik-manager",
                },
            ) as client:
                response = await client.get(settings.TRAEFIK_LATEST_VERSION_API_URL)
                response.raise_for_status()
                payload = response.json()
        except (httpx.HTTPError, ValueError):
            return self._build_error_info(checked_at, "최신 Traefik 버전을 확인하지 못했습니다")

        latest_version = payload.get("tag_name") if isinstance(payload, dict) else None
        if not isinstance(latest_version, str) or not parse_version(latest_version):
            return self._build_error_info(checked_at, "최신 Traefik 버전 응답을 해석하지 못했습니다")

        latest_release_url = payload.get("html_url") if isinstance(payload, dict) else None
        has_security_fixes, security_advisories = _extract_security_metadata(payload)
        return {
            "latest_version": latest_version,
            "latest_release_url": latest_release_url if isinstance(latest_release_url, str) else None,
            "latest_release_has_security_fixes": has_security_fixes,
            "latest_release_security_advisories": security_advisories,
            "update_available": None,
            "latest_version_checked_at": checked_at,
            "latest_version_error": None,
        }

    def _build_error_info(self, checked_at: datetime, message: str) -> dict:
        return {
            "latest_version": None,
            "latest_release_url": None,
            "latest_release_has_security_fixes": False,
            "latest_release_security_advisories": [],
            "update_available": None,
            "latest_version_checked_at": checked_at,
            "latest_version_error": message,
        }


def _extract_security_metadata(payload: object) -> tuple[bool, list[str]]:
    body = payload.get("body") if isinstance(payload, dict) else None
    if not isinstance(body, str):
        return False, []

    body = body[:200_000]
    advisories = sorted({match.upper() for match in _GHSA_PATTERN.findall(body)})[:50]
    return bool(advisories or _SECURITY_HEADING_PATTERN.search(body)), advisories
