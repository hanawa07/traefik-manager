#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  runDashboardVisualSmoke,
  runDashboardVisualSmokeSelfTest,
} from "./dashboard-visual-runner.mjs";
import {
  connectToSmokePage,
  evaluateInSmokePage as evaluate,
  launchSmokeChrome,
  navigateSmokePage,
  runSmokeBrowserCdpSelfTest,
} from "./smoke-browser-cdp.mjs";
import {
  formatCookieHeader,
  parseCookieHeader,
  parseSetCookieHeaders,
  resolveSessionCookies,
  splitCombinedSetCookie,
} from "./smoke-session-auth.mjs";
import {
  resolveOptionalSmokeAdminReadOnlySession,
  runSmokeAdminReadOnlySelfTest,
} from "./smoke-admin-read-only.mjs";
import {
  checkAdminVisualFixtures,
  runAdminVisualFixturesSelfTest,
} from "./dashboard-visual-admin-fixtures.mjs";
import {
  recordRemoteSmokeSuccess,
  runRemoteSmokeStatusSelfTest,
  writeSmokeAlertDetail,
} from "./smoke-remote-status.mjs";
import {
  resolveSmokeSessionCapabilities,
  runSmokeSessionCapabilitiesSelfTest,
} from "./smoke-session-capabilities.mjs";
import { runSmokeCiSummarySelfTest, writeSmokeCiSummary } from "./smoke-ci-summary.mjs";
import { runAuditSecuritySettingChangesSelfTest } from "./dashboard-visual-audit-security-setting-changes.mjs";
import {
  runSmokeServicesApiChecks,
  runSmokeServicesApiChecksSelfTest,
} from "./smoke-services-api-checks.mjs";

const DEFAULT_TIMEOUT_MS = 40_000;

if (process.argv.includes("--self-test")) {
  await runSelfTest();
  process.exit(0);
}

process.env.TM_SMOKE_STARTED_AT ||= new Date().toISOString();

main().catch(async (error) => {
  const message = String(error?.message || "알 수 없는 오류");
  await writeSmokeAlertDetail(message).catch(() => undefined);
  console.error(`서비스 브라우저 스모크 실패: ${message}`);
  process.exit(1);
});

async function main() {
  const baseUrl = resolveBaseUrl();
  const timeoutMs = Number(process.env.TM_SMOKE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const cookiePairs = await resolveSessionCookies(baseUrl);
  let adminCookies;
  try {
    adminCookies = await resolveOptionalSmokeAdminReadOnlySession(baseUrl);
  } catch (error) {
    throw new Error(`관리자 전용 점검 실패: ${error.message}`);
  }
  const adminReadOnlyChecked = Boolean(adminCookies);
  const chrome = await launchSmokeChrome(timeoutMs);

  try {
    const cdp = await connectToSmokePage(chrome.debugUrl, timeoutMs);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");
    await cdp.send("Network.setExtraHTTPHeaders", {
      headers: { "X-Traefik-Manager-Smoke": "visual" },
    });

    for (const cookie of cookiePairs) {
      await cdp.send("Network.setCookie", { url: baseUrl, ...cookie });
    }

    await navigateSmokePage(cdp, `${baseUrl}/dashboard/services`, timeoutMs);
    await waitForServicesPage(cdp, timeoutMs);

    const results = await runSmokeServicesApiChecks(cdp);

    const session = results.find((item) => item.label === "현재 세션")?.data;
    const capabilities = resolveSmokeSessionCapabilities(session);
    const visualResult = await runDashboardVisualSmoke({
      artifactDir: process.env.TM_SMOKE_ARTIFACT_DIR,
      baseUrl,
      capabilities,
      cdp,
      cookies: cookiePairs,
      timeoutMs,
    });
    if (adminCookies && await checkAdminVisualFixtures({
      artifactDir: process.env.TM_SMOKE_ARTIFACT_DIR,
      baseUrl, cdp, cookies: adminCookies, timeoutMs,
    })) {
      visualResult.labels.push("관리자 설정 저장 422·500·폼 유지·내부 오류 차단·English gateway 가져오기·API 보호·Traefik 알림 재시도 요청");
    }
    if (adminReadOnlyChecked) visualResult.labels.push("관리자 읽기 전용 403");
    await recordRemoteSmokeSuccess(
      baseUrl,
      cookiePairs,
      visualResult.adminChecked || adminReadOnlyChecked,
    );
    await writeSmokeCiSummary({
      adminReadOnlyChecked,
      apiCheckCount: results.length,
      capabilities,
      role: session.role,
      username: session.username,
      visualCheckCount: visualResult.labels.length,
    });

    const services = results.find((item) => item.label === "서비스 목록")?.data ?? [];
    console.log(`서비스 브라우저 스모크 통과: ${baseUrl}`);
    console.log(`- 세션: ${session.username} (${session.role})`);
    console.log(`- 서비스: ${services.length}개`);
    console.log(`- 확인 API: ${results.map((item) => item.label).join(", ")}`);
    console.log(`- 모바일 다크모드: ${visualResult.labels.join(", ")}`);
  } finally {
    await chrome.close();
  }
}

function resolveBaseUrl() {
  const raw =
    process.env.TM_SMOKE_BASE_URL ||
    process.env.FRONTEND_DOMAIN ||
    "http://localhost:3000";
  return normalizeBaseUrl(raw);
}

function normalizeBaseUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "http://localhost:3000";
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  return withScheme.replace(/\/+$/, "");
}

async function waitForServicesPage(cdp, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastHref = "";
  let lastText = "";

  while (Date.now() < deadline) {
    const snapshot = await evaluate(cdp, `({
      href: location.href,
      text: document.body.innerText.slice(0, 4000)
    })`);
    lastHref = snapshot.href;
    lastText = snapshot.text;
    if (new URL(snapshot.href).pathname === "/login") {
      throw new Error("서비스 화면 대신 로그인 화면으로 이동했습니다. 세션 쿠키를 확인하세요.");
    }
    if (
      snapshot.text.includes("서비스") &&
      snapshot.text.includes("Traefik 라우팅 서비스 관리")
    ) {
      return;
    }
    await sleep(300);
  }

  throw new Error(`서비스 화면 렌더링 대기 시간 초과: ${lastHref} ${lastText.slice(0, 200)}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSelfTest() {
  assert.equal(normalizeBaseUrl("example.com/"), "https://example.com");
  assert.equal(normalizeBaseUrl("http://localhost:3000/"), "http://localhost:3000");
  assert.deepEqual(parseCookieHeader("tm_session=abc; tm_csrf=def"), [
    { name: "tm_session", value: "abc" },
    { name: "tm_csrf", value: "def" },
  ]);
  assert.equal(
    formatCookieHeader([{ name: "tm_session", value: "abc" }, { name: "tm_csrf", value: "def" }]),
    "tm_session=abc; tm_csrf=def",
  );
  assert.deepEqual(
    splitCombinedSetCookie("a=1; Expires=Wed, 21 Oct 2030 07:28:00 GMT; Path=/, b=2; Path=/"),
    ["a=1; Expires=Wed, 21 Oct 2030 07:28:00 GMT; Path=/", "b=2; Path=/"],
  );
  assert.deepEqual(parseSetCookieHeaders(["tm_session=abc; Path=/; HttpOnly"]), [
    { name: "tm_session", value: "abc" },
  ]);
  runSmokeServicesApiChecksSelfTest();
  runAdminVisualFixturesSelfTest();
  await runSmokeAdminReadOnlySelfTest();
  await runRemoteSmokeStatusSelfTest();
  runSmokeCiSummarySelfTest();
  runAuditSecuritySettingChangesSelfTest();
  runSmokeSessionCapabilitiesSelfTest();
  await runSmokeBrowserCdpSelfTest();
  await runDashboardVisualSmokeSelfTest();
  console.log("서비스 브라우저 스모크 self-test 통과");
}
