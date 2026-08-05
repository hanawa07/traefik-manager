def _failed_run() -> dict:
    return {
        "run_id": 456,
        "status": "failure",
        "completed_at": "2026-07-11T06:54:58Z",
        "run_url": "https://github.com/hanawa07/traefik-manager/actions/runs/456",
        "run_number": 78,
        "commit_sha": "b3a4642",
        "summary": "실패 단계: 운영 로그인·화면 검사",
        "notification_suppressed": True,
        "artifact_url": "https://github.com/example/artifact",
        "artifact_expires_at": "2026-07-18T06:54:58Z",
    }


def _failure_summary(run_id: int, completed_at: str) -> dict:
    return {
        "run_id": run_id,
        "run_number": run_id,
        "completed_at": completed_at,
        "run_url": f"https://github.com/hanawa07/traefik-manager/actions/runs/{run_id}",
    }


def _statistics() -> list[dict]:
    return [
        {
            "window_days": 7,
            "total_count": 7,
            "success_count": 5,
            "failure_count": 1,
            "cancelled_count": 1,
            "skipped_count": 0,
            "duration_run_count": 7,
            "total_duration_seconds": 700,
            "average_duration_seconds": 100,
            "estimated_runner_minutes": 14,
            "slowest_runs": [],
        },
        {
            "window_days": 30,
            "total_count": 30,
            "success_count": 25,
            "failure_count": 3,
            "cancelled_count": 1,
            "skipped_count": 1,
            "duration_run_count": 30,
            "total_duration_seconds": 3000,
            "average_duration_seconds": 100,
            "estimated_runner_minutes": 60,
            "slowest_runs": [],
        },
    ]


class StubSmokeHistoryReader:
    force_refresh = False
    recent_days = None
    page = 1
    search = ""
    status_filter = "all"
    cancellation_reason_filter = "all"

    async def get_history(
        self,
        _source_url: str,
        *,
        force_refresh: bool = False,
        recent_days: int | None = None,
        page: int = 1,
        search: str = "",
        status_filter: str = "all",
        cancellation_reason_filter: str = "all",
    ) -> dict:
        self.force_refresh = force_refresh
        self.recent_days = recent_days
        self.page = page
        self.search = search
        self.status_filter = status_filter
        self.cancellation_reason_filter = cancellation_reason_filter
        failed_run = _failed_run()
        return {
            "runs": [failed_run.copy()],
            "latest_failure": failed_run.copy(),
            "statistics": _statistics(),
            "failure_runs_by_window": {
                7: [_failure_summary(456, "2026-07-11T06:54:58Z")],
                14: [_failure_summary(456, "2026-07-11T06:54:58Z")],
                30: [
                    _failure_summary(456, "2026-07-11T06:54:58Z"),
                    _failure_summary(457, "2026-07-01T06:54:58Z"),
                    _failure_summary(458, "2026-06-30T06:54:58Z"),
                ],
            },
            "checked_at": "2026-07-13T01:00:00+00:00",
            "data_checked_at": "2026-07-13T00:55:00+00:00",
            "recent_days": recent_days,
            "page": page,
            "per_page": 5,
            "total": 8,
            "total_pages": 2,
            "search": search,
            "status_filter": status_filter,
            "cancellation_reason_filter": cancellation_reason_filter,
            "github_api_request_usage": {
                "total": 6,
                "workflow": 1,
                "job": 4,
                "artifact": 1,
            },
            "error": None,
        }
