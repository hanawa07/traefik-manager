import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";

import { formatCookieHeader } from "./smoke-session-auth.mjs";

const ADMIN_STALE_DRY_RUN_MESSAGE =
  "관리자 전용 점검이 2일 넘게 성공하지 않았습니다 (dry-run)";
const FAILURE_TYPE_LABELS = {
  external_api: "외부 API",
  login: "로그인",
  visual_regression: "화면 회귀",
};

if (process.argv.includes("--admin-stale-dry-run")) {
  await writeSmokeAlertDetail(ADMIN_STALE_DRY_RUN_MESSAGE);
  console.error(ADMIN_STALE_DRY_RUN_MESSAGE);
  process.exit(1);
}

export async function recordRemoteSmokeSuccess(
  baseUrl,
  cookies,
  adminChecked,
  env = process.env,
  fetchImpl = fetch,
) {
  const runId = env.GITHUB_RUN_ID;
  if (!runId) return;

  const csrf = cookies.find((cookie) => cookie.name.toLowerCase().includes("csrf"));
  assert.ok(csrf, "원격 스모크 성공 기록에 필요한 CSRF 쿠키가 없습니다");
  const cookie = formatCookieHeader(cookies);
  const completedAt = new Date().toISOString();
  const response = await fetchImpl(`${baseUrl}/api/v1/settings/smoke-run-success`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
      "x-csrf-token": csrf.value,
    },
    body: JSON.stringify({
      admin_checked: adminChecked,
      run_id: Number(runId),
      started_at: env.TM_SMOKE_STARTED_AT || null,
      completed_at: completedAt,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`원격 스모크 성공 기록 API ${response.status}: ${text.slice(0, 200)}`);
  }

  if (!adminChecked && env.TM_SMOKE_ADMIN_EXPECT_READ_ONLY !== "1") return;
  const statusResponse = await fetchImpl(
    `${baseUrl}/api/v1/settings/smoke-rotation?summary=true`,
    { headers: { cookie } },
  );
  if (!statusResponse.ok) {
    const text = await statusResponse.text();
    throw new Error(`관리자 전용 점검 상태 API ${statusResponse.status}: ${text.slice(0, 200)}`);
  }
  const message = getAdminSmokeAlertMessage(await statusResponse.json());
  if (message) throw new Error(message);
}

export async function recordRemoteSmokeFailure(
  baseUrl,
  cookies,
  metadata,
  env = process.env,
  fetchImpl = fetch,
) {
  const runId = env.GITHUB_RUN_ID;
  if (!runId || !metadata) return;

  const csrf = cookies.find((cookie) => cookie.name.toLowerCase().includes("csrf"));
  assert.ok(csrf, "원격 스모크 실패 기록에 필요한 CSRF 쿠키가 없습니다");
  const response = await fetchImpl(`${baseUrl}/api/v1/settings/smoke-run-failure`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: formatCookieHeader(cookies),
      "x-csrf-token": csrf.value,
    },
    body: JSON.stringify({
      run_id: Number(runId),
      ...metadata,
      failure_type: metadata.failure_type ?? classifySmokeFailure(metadata.check_name),
      started_at: env.TM_SMOKE_STARTED_AT || null,
      completed_at: metadata.captured_at || new Date().toISOString(),
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`원격 스모크 실패 기록 API ${response.status}: ${text.slice(0, 200)}`);
  }
}

export async function writeSmokeAlertDetail(message, env = process.env) {
  const path = env.TM_SMOKE_ALERT_DETAIL_FILE;
  if (!path) return;
  await writeFile(path, buildSmokeAlertDetail(message).slice(0, 500), "utf8");
}

export function classifySmokeFailure(message) {
  const text = String(message || "");
  if (/로그인|세션|인증|계정 자동 회전/.test(text)) return "login";
  if (/GitHub|Cloudflare|Traefik/.test(text)) return "external_api";
  if (/관리자 전용 점검/.test(text)) return "login";
  if (/원격|(?:^|\s)API(?:\s|$)/.test(text)) return "external_api";
  return "visual_regression";
}

function getAdminSmokeAlertMessage(status) {
  if (!status?.monitoring_enabled) return null;
  if (!status.monitoring_admin_last_success_at) {
    return "관리자 전용 점검 성공 기록이 없습니다";
  }
  if (status.monitoring_admin_is_stale) {
    return `관리자 전용 점검이 ${status.monitoring_admin_stale_after_days}일 넘게 성공하지 않았습니다`;
  }
  return null;
}

function buildSmokeAlertDetail(message) {
  const detail = String(message || "알 수 없는 오류").replace(/\s+/g, " ").trim();
  const failureType = classifySmokeFailure(detail);
  return `유형: ${FAILURE_TYPE_LABELS[failureType]}\n상세: ${detail}`;
}

export async function runRemoteSmokeStatusSelfTest() {
  const cookies = [
    { name: "tm_session", value: "session" },
    { name: "tm_csrf", value: "csrf" },
  ];
  const requests = [];
  await recordRemoteSmokeSuccess(
    "https://manager.example.com",
    cookies,
    true,
    {
      GITHUB_RUN_ID: "123",
      TM_SMOKE_ADMIN_EXPECT_READ_ONLY: "1",
      TM_SMOKE_STARTED_AT: "2026-07-18T00:00:00Z",
    },
    async (url, options = {}) => {
      requests.push({ options, url });
      if (options.method === "POST") return new Response("{}", { status: 200 });
      return new Response(
        JSON.stringify({
          monitoring_admin_is_stale: false,
          monitoring_admin_last_success_at: "2026-07-18T00:00:00+00:00",
          monitoring_enabled: true,
        }),
        { status: 200 },
      );
    },
  );
  assert.equal(requests.length, 2);
  assert.equal(requests[0].options.headers["x-csrf-token"], "csrf");
  const successBody = JSON.parse(requests[0].options.body);
  assert.equal(successBody.admin_checked, true);
  assert.equal(successBody.started_at, "2026-07-18T00:00:00Z");
  assert.match(successBody.completed_at, /^\d{4}-\d{2}-\d{2}T/);
  const failureRequests = [];
  await recordRemoteSmokeFailure(
    "https://manager.example.com",
    cookies,
    {
      captured_at: "2026-07-21T01:02:03Z",
      check_name: "설정 화면 검사 실패",
      screen_path: "/dashboard/settings",
      page_title: "설정",
    },
    { GITHUB_RUN_ID: "456", TM_SMOKE_STARTED_AT: "2026-07-21T01:00:03Z" },
    async (url, options) => {
      failureRequests.push({ options, url });
      return new Response("{}", { status: 200 });
    },
  );
  assert.match(failureRequests[0].url, /smoke-run-failure$/);
  const failureBody = JSON.parse(failureRequests[0].options.body);
  assert.equal(failureBody.run_id, 456);
  assert.equal(failureBody.failure_type, "visual_regression");
  assert.equal(failureBody.screen_path, "/dashboard/settings");
  assert.equal(failureBody.started_at, "2026-07-21T01:00:03Z");
  assert.equal(failureBody.completed_at, "2026-07-21T01:02:03Z");
  assert.match(
    getAdminSmokeAlertMessage({
      monitoring_admin_is_stale: true,
      monitoring_admin_last_success_at: "2026-07-10T00:00:00+00:00",
      monitoring_admin_stale_after_days: 2,
      monitoring_enabled: true,
    }),
    /2일/,
  );
  assert.equal(
    getAdminSmokeAlertMessage({ monitoring_admin_is_stale: true, monitoring_enabled: false }),
    null,
  );
  assert.equal(classifySmokeFailure("로그인 API 401"), "login");
  assert.equal(classifySmokeFailure("Traefik Manager 인증 실패"), "login");
  assert.equal(classifySmokeFailure("GitHub API 503"), "external_api");
  assert.equal(classifySmokeFailure("설정 화면 검사 실패"), "visual_regression");
  assert.equal(
    buildSmokeAlertDetail("GitHub API 503"),
    "유형: 외부 API\n상세: GitHub API 503",
  );
  assert.match(ADMIN_STALE_DRY_RUN_MESSAGE, /dry-run/);
}
