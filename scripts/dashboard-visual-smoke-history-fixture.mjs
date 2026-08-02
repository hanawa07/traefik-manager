import assert from "node:assert/strict";

import { evaluate } from "./dashboard-visual-runtime.mjs";

export const RUN_URL = "https://github.com/hanawa07/traefik-manager/actions/runs/987";
export const COMMIT_URL = "https://github.com/hanawa07/traefik-manager/commit/abcdef0";
export const ARTIFACT_URL = `${RUN_URL}/artifacts/654`;
const EXPIRED_RUN_URL = "https://github.com/hanawa07/traefik-manager/actions/runs/986";
export const EXPIRED_ARTIFACT_URL = `${EXPIRED_RUN_URL}/artifacts/653`;
const SUCCESS_RUN_URL = "https://github.com/hanawa07/traefik-manager/actions/runs/985";
export const PAGE_TWO_RUN_URL = "https://github.com/hanawa07/traefik-manager/actions/runs/984";

export async function buildSmokeHistoryFixtures(cdp) {
  const fixture = await evaluate(cdp, `(async () => {
    const response = await fetch('/api/v1/settings/smoke-rotation');
    if (!response.ok) return null;
    const status = await response.json();
    const failedRun = {
      run_id: 987,
      status: 'failure',
      completed_at: '2026-07-20T06:00:00Z',
      run_url: ${JSON.stringify(RUN_URL)},
      run_number: 987,
      commit_sha: 'abcdef0',
      summary: '실패 단계: 운영 로그인·화면 검사',
      cancellation_reason: null,
      notification_suppressed: false,
      artifact_url: ${JSON.stringify(ARTIFACT_URL)},
      artifact_expires_at: '2026-07-23T06:00:00Z',
      failure_metadata: {
        captured_at: '2026-07-20T06:00:01Z',
        check_name: '설정 화면 검사 실패',
        screen_path: '/dashboard/settings',
        page_title: 'Traefik Manager 설정',
      },
    };
    const expiredRun = {
      ...failedRun,
      run_id: 986,
      run_url: ${JSON.stringify(EXPIRED_RUN_URL)},
      run_number: 986,
      artifact_url: ${JSON.stringify(EXPIRED_ARTIFACT_URL)},
      artifact_expires_at: '2026-07-19T06:00:00Z',
      failure_metadata: {
        ...failedRun.failure_metadata,
        check_name: '만료된 실패 화면 검사',
      },
    };
    const successRun = {
      ...failedRun,
      run_id: 985,
      status: 'success',
      run_url: ${JSON.stringify(SUCCESS_RUN_URL)},
      run_number: 985,
      summary: '운영 로그인·화면 검사 성공',
      artifact_url: null,
      artifact_expires_at: null,
      failure_metadata: null,
    };
    const cancelledRun = {
      ...successRun,
      run_id: 983,
      status: 'cancelled',
      run_url: 'https://github.com/hanawa07/traefik-manager/actions/runs/983',
      run_number: 983,
      summary: 'GitHub 새 실행으로 대체 추정 · 앱 실패율 제외',
      cancellation_reason: 'superseded',
    };
    const slowFailure = {
      run_id: 987,
      run_number: 987,
      status: 'failure',
      completed_at: failedRun.completed_at,
      duration_seconds: 180,
      commit_sha: 'abcdef0',
      run_url: failedRun.run_url,
    };
    const slowSuccess = {
      ...slowFailure,
      run_id: 985,
      run_number: 985,
      status: 'success',
      completed_at: successRun.completed_at,
      duration_seconds: 120,
      run_url: successRun.run_url,
    };
    return {
      ...status,
      monitoring_history_checked_at: '2026-07-21T06:00:00Z',
      monitoring_history_days: 30,
      monitoring_history_page: 1,
      monitoring_history_per_page: 5,
      monitoring_history_total: 8,
      monitoring_history_total_pages: 2,
      monitoring_history_search: '',
      monitoring_history_status: 'all',
      monitoring_history_cancellation_reason: 'all',
      monitoring_run_statistics: [
        {
          window_days: 7,
          total_count: 4,
          success_count: 1,
          failure_count: 2,
          cancelled_count: 1,
          skipped_count: 0,
          duration_run_count: 4,
          total_duration_seconds: 420,
          average_duration_seconds: 105,
          estimated_runner_minutes: 8,
          slowest_runs: [slowFailure],
        },
        {
          window_days: 30,
          total_count: 8,
          success_count: 5,
          failure_count: 2,
          cancelled_count: 1,
          skipped_count: 0,
          duration_run_count: 8,
          total_duration_seconds: 900,
          average_duration_seconds: 113,
          estimated_runner_minutes: 17,
          slowest_runs: [slowFailure, slowSuccess],
        },
      ],
      monitoring_statistics_snapshots: [
        {
          captured_on: '2026-07-21',
          window_days: 30,
          total_count: 8,
          success_count: 5,
          failure_count: 2,
          cancelled_count: 1,
          skipped_count: 0,
          duration_run_count: 8,
          total_duration_seconds: 900,
          average_duration_seconds: 113,
          estimated_runner_minutes: 17,
        },
        {
          captured_on: '2026-06-21',
          window_days: 30,
          total_count: 7,
          success_count: 6,
          failure_count: 1,
          cancelled_count: 0,
          skipped_count: 0,
          duration_run_count: 7,
          total_duration_seconds: 700,
          average_duration_seconds: 100,
          estimated_runner_minutes: 14,
        },
      ],
      monitoring_failure_metadata_count: 1,
      monitoring_failure_metadata_limit: 20,
      monitoring_github_refresh_reserve: 10,
      monitoring_github_rate_limit_remaining: 10,
      monitoring_github_rate_limit_limit: 60,
      monitoring_github_rate_limit_reset_at: new Date(Date.now() + 5 * 60_000).toISOString(),
      monitoring_latest_failure: expiredRun,
      monitoring_recent_runs: [failedRun, expiredRun, successRun, cancelledRun],
    };
  })()`);
  assert.ok(fixture, "운영 점검 최근 이력 fixture의 기본 응답을 읽지 못했습니다");
  const successFixture = {
    ...fixture,
    monitoring_history_status: "success",
    monitoring_history_total: 1,
    monitoring_history_total_pages: 1,
    monitoring_recent_runs: [fixture.monitoring_recent_runs[2]],
  };
  const failureFixture = {
    ...fixture,
    monitoring_history_status: "failure",
    monitoring_history_total: 2,
    monitoring_history_total_pages: 1,
    monitoring_recent_runs: fixture.monitoring_recent_runs.slice(0, 2),
  };
  const cancelledFixture = {
    ...fixture,
    monitoring_history_status: "cancelled",
    monitoring_history_total: 1,
    monitoring_history_total_pages: 1,
    monitoring_recent_runs: [fixture.monitoring_recent_runs[3]],
  };
  const supersededFixture = {
    ...cancelledFixture,
    monitoring_history_cancellation_reason: "superseded",
  };
  const searchFixture = {
    ...failureFixture,
    monitoring_history_search: "986",
    monitoring_history_total: 1,
    monitoring_recent_runs: [fixture.monitoring_recent_runs[1]],
  };
  const sevenDayFixture = {
    ...fixture,
    monitoring_history_days: 7,
    monitoring_history_total: 8,
    monitoring_history_total_pages: 2,
  };
  const pageTwoFixture = {
    ...sevenDayFixture,
    monitoring_history_page: 2,
    monitoring_recent_runs: [{
      ...fixture.monitoring_recent_runs[2],
      run_id: 984,
      run_number: 984,
      run_url: PAGE_TWO_RUN_URL,
    }],
  };

  return {
    cancelledFixture,
    failureFixture,
    fixture,
    pageTwoFixture,
    searchFixture,
    sevenDayFixture,
    successFixture,
    supersededFixture,
  };
}

export async function fulfillJsonRequest(cdp, request, payload) {
  await cdp.send("Fetch.fulfillRequest", {
    requestId: request.requestId,
    responseCode: 200,
    responseHeaders: [{ name: "Content-Type", value: "application/json" }],
    body: Buffer.from(JSON.stringify(payload)).toString("base64"),
  });
}
