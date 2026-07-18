import assert from "node:assert/strict";

import { formatCookieHeader, loginSessionCookies } from "./smoke-session-auth.mjs";

const PROBE_USER_ID = "00000000-0000-0000-0000-000000000000";
const READ_ONLY_DETAIL = "전용 스모크 관리자 계정은 조회만 할 수 있습니다";

export async function checkOptionalSmokeAdminReadOnly(baseUrl, env = process.env) {
  if (env.TM_SMOKE_ADMIN_EXPECT_READ_ONLY !== "1") return false;

  const username = env.TM_SMOKE_ADMIN_USERNAME;
  const password = env.TM_SMOKE_ADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error("읽기 전용 검증에 필요한 전용 admin 인증값이 없습니다");
  }

  const cookies = await loginSessionCookies(baseUrl, username, password);
  await assertSmokeAdminReadOnly(baseUrl, cookies);
  return true;
}

export async function assertSmokeAdminReadOnly(baseUrl, cookies, fetchImpl = fetch) {
  const csrf = cookies.find((cookie) => cookie.name.toLowerCase().includes("csrf"));
  assert.ok(csrf, "전용 admin 쓰기 차단 검증에 필요한 CSRF 쿠키가 없습니다");

  const response = await fetchImpl(`${baseUrl}/api/v1/users/${PROBE_USER_ID}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      cookie: formatCookieHeader(cookies),
      "x-csrf-token": csrf.value,
    },
    body: "{}",
  });
  const body = await response.text();
  assert.equal(response.status, 403, `전용 admin 쓰기 요청이 ${response.status}로 응답했습니다: ${body.slice(0, 200)}`);
  assert.equal(JSON.parse(body).detail, READ_ONLY_DETAIL);
}

export async function runSmokeAdminReadOnlySelfTest() {
  let captured;
  await assertSmokeAdminReadOnly(
    "https://manager.example.com",
    [
      { name: "tm_session", value: "session" },
      { name: "tm_csrf", value: "csrf" },
    ],
    async (url, options) => {
      captured = { options, url };
      return new Response(JSON.stringify({ detail: READ_ONLY_DETAIL }), { status: 403 });
    },
  );

  assert.equal(new URL(captured.url).pathname, `/api/v1/users/${PROBE_USER_ID}`);
  assert.equal(captured.options.method, "PUT");
  assert.equal(captured.options.headers["x-csrf-token"], "csrf");
  assert.equal(await checkOptionalSmokeAdminReadOnly("https://manager.example.com", {}), false);
}
