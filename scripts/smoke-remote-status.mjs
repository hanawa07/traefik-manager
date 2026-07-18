import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";

import { formatCookieHeader } from "./smoke-session-auth.mjs";

const ADMIN_STALE_DRY_RUN_MESSAGE =
  "관리자 전용 점검이 2일 넘게 성공하지 않았습니다 (dry-run)";

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
  const response = await fetchImpl(`${baseUrl}/api/v1/settings/smoke-run-success`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
      "x-csrf-token": csrf.value,
    },
    body: JSON.stringify({ admin_checked: adminChecked, run_id: Number(runId) }),
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

export async function writeSmokeAlertDetail(message, env = process.env) {
  const path = env.TM_SMOKE_ALERT_DETAIL_FILE;
  if (!path || !isAlertDetail(message)) return;
  await writeFile(path, message.slice(0, 500), "utf8");
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

function isAlertDetail(message) {
  return (
    message.startsWith("스모크 계정 자동 회전") ||
    message.startsWith("관리자 전용 점검")
  );
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
    { GITHUB_RUN_ID: "123", TM_SMOKE_ADMIN_EXPECT_READ_ONLY: "1" },
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
  assert.equal(JSON.parse(requests[0].options.body).admin_checked, true);
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
  assert.equal(isAlertDetail("관리자 전용 점검이 지연되었습니다"), true);
  assert.equal(isAlertDetail("일반 화면 오류"), false);
  assert.match(ADMIN_STALE_DRY_RUN_MESSAGE, /dry-run/);
}
