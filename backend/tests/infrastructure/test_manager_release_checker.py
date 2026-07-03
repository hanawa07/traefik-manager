from datetime import datetime

import pytest

from app.infrastructure.docker import deployment_release
from app.infrastructure.docker.deployment_release import ManagerReleaseChecker, build_latest_release_api_url


def test_build_latest_release_api_url_from_https_source():
    assert (
        build_latest_release_api_url("https://github.com/hanawa07/traefik-manager.git")
        == "https://api.github.com/repos/hanawa07/traefik-manager/releases/latest"
    )


def test_build_latest_release_api_url_from_ssh_source():
    assert (
        build_latest_release_api_url("git@github.com:hanawa07/traefik-manager.git")
        == "https://api.github.com/repos/hanawa07/traefik-manager/releases/latest"
    )


def test_build_latest_release_api_url_rejects_non_github_source():
    assert build_latest_release_api_url("https://example.com/hanawa07/traefik-manager") is None


@pytest.mark.asyncio
async def test_get_release_status_compares_current_with_latest(monkeypatch):
    ManagerReleaseChecker._latest_release_cache = {}
    captured: dict[str, object] = {}

    class FakeResponse:
        status_code = 200

        def raise_for_status(self):
            return None

        def json(self):
            return {
                "tag_name": "v0.2.0",
                "html_url": "https://github.com/hanawa07/traefik-manager/releases/tag/v0.2.0",
            }

    class FakeAsyncClient:
        def __init__(self, **kwargs):
            captured["kwargs"] = kwargs

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url: str):
            captured["url"] = url
            return FakeResponse()

    monkeypatch.setattr(deployment_release.httpx, "AsyncClient", FakeAsyncClient)
    monkeypatch.setattr(deployment_release.settings, "TRAEFIK_MANAGER_LATEST_RELEASE_API_URL", None)
    monkeypatch.setattr(deployment_release.settings, "TRAEFIK_MANAGER_LATEST_RELEASE_TIMEOUT_SECONDS", 1.0)
    monkeypatch.setattr(deployment_release.settings, "TRAEFIK_MANAGER_LATEST_RELEASE_CACHE_SECONDS", 60)

    result = await ManagerReleaseChecker().get_release_status(
        "0.1.0",
        "https://github.com/hanawa07/traefik-manager",
    )

    assert captured["url"] == "https://api.github.com/repos/hanawa07/traefik-manager/releases/latest"
    assert result["latest_version"] == "v0.2.0"
    assert result["latest_release_url"] == "https://github.com/hanawa07/traefik-manager/releases/tag/v0.2.0"
    assert result["latest_version_error"] is None
    assert result["update_available"] is True
    assert isinstance(result["latest_version_checked_at"], datetime)
