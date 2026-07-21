import pytest

from app.infrastructure.smoke_run_details import (
    read_smoke_artifacts,
    read_smoke_job_steps,
)


class _Response:
    headers: dict[str, str] = {}

    def __init__(self, payload: dict) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return self._payload


class _Client:
    def __init__(self) -> None:
        self.calls: list[str] = []

    async def get(self, url: str, *, params: dict) -> _Response:
        self.calls.append(url)
        if url.endswith("/jobs"):
            return _Response({"jobs": [{"steps": [{"name": "운영 로그인·화면 검사"}]}]})
        return _Response(
            {
                "artifacts": [
                    {
                        "id": 654,
                        "name": "dashboard-visual-smoke-123",
                        "expired": False,
                        "expires_at": "2026-07-29T00:00:00Z",
                        "workflow_run": {"id": 123},
                    }
                ]
            }
        )


@pytest.mark.asyncio
async def test_smoke_run_details_cache_each_run_and_support_force_refresh() -> None:
    client = _Client()
    api_url = "https://api.github.com/repos/example/detail-cache-test"
    public_url = "https://github.com/example/detail-cache-test"

    first_steps = await read_smoke_job_steps(client, api_url, 123)
    cached_steps = await read_smoke_job_steps(client, api_url, 123)
    await read_smoke_job_steps(client, api_url, 123, force_refresh=True)
    first_artifacts = await read_smoke_artifacts(
        client,
        api_url,
        public_url,
        {123, 456},
    )
    cached_artifacts = await read_smoke_artifacts(
        client,
        api_url,
        public_url,
        {123, 456},
    )
    await read_smoke_artifacts(
        client,
        api_url,
        public_url,
        {123, 456},
        force_refresh=True,
    )

    assert cached_steps == first_steps
    assert cached_artifacts == first_artifacts
    assert first_artifacts[123]["url"].endswith("/artifacts/654")
    assert sum(url.endswith("/jobs") for url in client.calls) == 2
    assert sum(url.endswith("/artifacts") for url in client.calls) == 2
