import asyncio
import re
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

import httpx

WORKFLOW_FILE = "dashboard-visual-smoke.yml"
RECENT_RUN_LIMIT = 5
_CACHE_SECONDS = 600
_REPOSITORY_PART_RE = re.compile(r"^[A-Za-z0-9_.-]+$")


class GitHubSmokeRunHistoryReader:
    """Read recent smoke results from the repository's public Actions metadata."""

    _cache: dict[str, tuple[datetime, dict[str, Any]]] = {}
    _lock = asyncio.Lock()

    async def get_history(
        self,
        source_url: str | None,
        *,
        force_refresh: bool = False,
    ) -> dict[str, Any]:
        repository_urls = _resolve_repository_urls(source_url)
        if repository_urls is None:
            return _history_error("GitHub 저장소 주소를 확인하지 못했습니다")

        api_url, public_url = repository_urls
        now = datetime.now(timezone.utc)
        cached = self._cache.get(api_url)
        if not force_refresh and cached and (now - cached[0]).total_seconds() < _CACHE_SECONDS:
            return _copy_history(cached[1])

        async with self._lock:
            cached = self._cache.get(api_url)
            if not force_refresh and cached and (now - cached[0]).total_seconds() < _CACHE_SECONDS:
                return _copy_history(cached[1])

            history = await self._fetch_history(api_url, public_url)
            if history["error"] and cached and cached[1]["runs"]:
                history["runs"] = cached[1]["runs"]
            GitHubSmokeRunHistoryReader._cache[api_url] = (now, _copy_history(history))
            return history

    async def _fetch_history(self, api_url: str, public_url: str) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient(
                timeout=4.0,
                headers={
                    "Accept": "application/vnd.github+json",
                    "User-Agent": "traefik-manager",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
            ) as client:
                response = await client.get(
                    f"{api_url}/actions/workflows/{WORKFLOW_FILE}/runs",
                    params={"per_page": 20},
                )
                response.raise_for_status()
                payload = response.json()
                raw_runs = payload.get("workflow_runs") if isinstance(payload, dict) else None
                runs = _select_recent_runs(raw_runs)
                artifact_run_ids = {
                    run["id"] for run in runs if run.get("conclusion") != "success"
                }
                jobs, artifact_urls = await asyncio.gather(
                    asyncio.gather(
                        *(
                            self._read_job_steps(client, api_url, run["id"])
                            if _needs_job_details(run)
                            else _empty_steps()
                            for run in runs
                        )
                    ),
                    self._read_artifact_urls(
                        client,
                        api_url,
                        public_url,
                        artifact_run_ids,
                    )
                    if artifact_run_ids
                    else _empty_artifact_urls(),
                )
        except (httpx.HTTPError, ValueError, TypeError):
            return _history_error("GitHub 실행 이력을 확인하지 못했습니다")

        return {
            "runs": [
                build_smoke_run_item(
                    run,
                    steps,
                    public_url=public_url,
                    artifact_url=artifact_urls.get(run["id"]),
                )
                for run, steps in zip(runs, jobs, strict=True)
            ],
            "error": None,
        }

    async def _read_job_steps(
        self,
        client: httpx.AsyncClient,
        api_url: str,
        run_id: int,
    ) -> list[dict[str, Any]]:
        try:
            response = await client.get(
                f"{api_url}/actions/runs/{run_id}/jobs",
                params={"per_page": 10},
            )
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError, TypeError):
            return []

        jobs = payload.get("jobs") if isinstance(payload, dict) else None
        if not isinstance(jobs, list):
            return []
        return [
            step
            for job in jobs
            if isinstance(job, dict) and isinstance(job.get("steps"), list)
            for step in job["steps"]
            if isinstance(step, dict)
        ]

    async def _read_artifact_urls(
        self,
        client: httpx.AsyncClient,
        api_url: str,
        public_url: str,
        run_ids: set[int],
    ) -> dict[int, str]:
        try:
            response = await client.get(
                f"{api_url}/actions/artifacts",
                params={"per_page": 100},
            )
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError, TypeError):
            return {}

        artifacts = payload.get("artifacts") if isinstance(payload, dict) else None
        return build_smoke_artifact_urls(
            artifacts,
            run_ids=run_ids,
            public_url=public_url,
        )


def build_smoke_run_item(
    run: dict[str, Any],
    steps: list[dict[str, Any]],
    *,
    public_url: str,
    artifact_url: str | None = None,
) -> dict[str, Any]:
    smoke_step = _find_step(steps, "운영 로그인·화면 검사")
    conclusion = _clean_text(run.get("conclusion"))
    if smoke_step and smoke_step.get("conclusion") == "skipped":
        status = "skipped"
        summary = "예약 설정에 따라 점검을 건너뜀"
    elif conclusion == "success":
        status = "success"
        summary = None
    else:
        status = "failure"
        failed_step = next(
            (
                step
                for step in steps
                if step.get("conclusion") in {"failure", "cancelled", "timed_out"}
            ),
            None,
        )
        step_name = _clean_text(failed_step.get("name")) if failed_step else None
        summary = f"실패 단계: {step_name[:120]}" if step_name else f"GitHub 결과: {conclusion or '알 수 없음'}"

    cooldown_step = _find_step(steps, "반복 실패 알림 cooldown 확인")
    telegram_step = _find_step(steps, "Telegram 실패 알림")
    suppressed = bool(
        status == "failure"
        and cooldown_step
        and cooldown_step.get("conclusion") == "success"
        and telegram_step
        and telegram_step.get("conclusion") == "skipped"
    )
    run_id = run["id"]
    head_sha = _clean_text(run.get("head_sha"))
    return {
        "status": status,
        "completed_at": run["updated_at"],
        "run_url": f"{public_url}/actions/runs/{run_id}",
        "run_number": run.get("run_number") if isinstance(run.get("run_number"), int) else None,
        "commit_sha": head_sha[:7] if head_sha else None,
        "summary": summary,
        "notification_suppressed": suppressed,
        "artifact_url": artifact_url if status == "failure" else None,
    }


def build_smoke_artifact_urls(
    raw_artifacts: object,
    *,
    run_ids: set[int],
    public_url: str,
) -> dict[int, str]:
    if not isinstance(raw_artifacts, list):
        return {}
    urls: dict[int, str] = {}
    for artifact in raw_artifacts:
        workflow_run = artifact.get("workflow_run") if isinstance(artifact, dict) else None
        run_id = workflow_run.get("id") if isinstance(workflow_run, dict) else None
        artifact_id = artifact.get("id") if isinstance(artifact, dict) else None
        if (
            not isinstance(run_id, int)
            or run_id not in run_ids
            or not isinstance(artifact_id, int)
            or artifact.get("name") != f"dashboard-visual-smoke-{run_id}"
            or artifact.get("expired") is not False
        ):
            continue
        urls.setdefault(
            run_id,
            f"{public_url}/actions/runs/{run_id}/artifacts/{artifact_id}",
        )
    return urls


async def _empty_steps() -> list[dict[str, Any]]:
    return []


async def _empty_artifact_urls() -> dict[int, str]:
    return {}


def _select_recent_runs(raw_runs: object) -> list[dict[str, Any]]:
    if not isinstance(raw_runs, list):
        raise ValueError("workflow_runs must be a list")
    return [
        run
        for run in raw_runs
        if isinstance(run, dict)
        and isinstance(run.get("id"), int)
        and isinstance(run.get("updated_at"), str)
        and run.get("status") == "completed"
        and not str(run.get("display_title") or "").startswith("[테스트]")
    ][:RECENT_RUN_LIMIT]


def _needs_job_details(run: dict[str, Any]) -> bool:
    return run.get("event") == "schedule" or run.get("conclusion") != "success"


def _find_step(steps: list[dict[str, Any]], name: str) -> dict[str, Any] | None:
    return next((step for step in steps if step.get("name") == name), None)


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


def _history_error(message: str) -> dict[str, Any]:
    return {"runs": [], "error": message}


def _copy_history(history: dict[str, Any]) -> dict[str, Any]:
    return {
        "runs": [run.copy() for run in history["runs"]],
        "error": history["error"],
    }
