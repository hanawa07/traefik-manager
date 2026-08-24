from datetime import datetime

import pytest

from app.infrastructure.traefik import traefik_release_checker as release_checker_module
from app.infrastructure.traefik.traefik_release_checker import TraefikReleaseChecker


@pytest.mark.asyncio
async def test_release_checker_fetches_and_caches_latest_version(monkeypatch):
    requests = []

    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return {
                "tag_name": "v3.7.9",
                "html_url": "https://github.com/traefik/traefik/releases/tag/v3.7.9",
                "body": """## CVE Fixed
- https://github.com/traefik/traefik/security/advisories/GHSA-3CCP-42PG-HGV6
- https://github.com/traefik/traefik/security/advisories/ghsa-g55h-rg46-x9c5
""",
            }

    class FakeAsyncClient:
        def __init__(self, **_kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            pass

        async def get(self, url):
            requests.append(url)
            return FakeResponse()

    monkeypatch.setattr(release_checker_module.httpx, "AsyncClient", FakeAsyncClient)
    monkeypatch.setattr(TraefikReleaseChecker, "_latest_version_cache", None)

    checker = TraefikReleaseChecker()
    first = await checker.get_latest_version_info()
    second = await checker.get_latest_version_info()

    assert requests == [release_checker_module.settings.TRAEFIK_LATEST_VERSION_API_URL]
    assert first["latest_version"] == "v3.7.9"
    assert first["latest_release_url"].endswith("/v3.7.9")
    assert first["latest_release_has_security_fixes"] is True
    assert first["latest_release_security_advisories"] == [
        "GHSA-3CCP-42PG-HGV6",
        "GHSA-G55H-RG46-X9C5",
    ]
    assert isinstance(first["latest_version_checked_at"], datetime)
    assert second == first
