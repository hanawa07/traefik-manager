#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import {
  runDashboardVisualSmoke,
  runDashboardVisualSmokeSelfTest,
} from "./dashboard-visual-smoke.mjs";
import {
  formatCookieHeader,
  parseCookieHeader,
  parseSetCookieHeaders,
  resolveSessionCookies,
  splitCombinedSetCookie,
} from "./smoke-session-auth.mjs";
import {
  checkOptionalSmokeAdminReadOnly,
  runSmokeAdminReadOnlySelfTest,
} from "./smoke-admin-read-only.mjs";
import {
  recordRemoteSmokeSuccess,
  runRemoteSmokeStatusSelfTest,
  writeSmokeAlertDetail,
} from "./smoke-remote-status.mjs";

const DEFAULT_TIMEOUT_MS = 40_000;

const CHECKS = [
  {
    label: "애플리케이션 헬스",
    path: "/api/health",
    validate: (data) => data?.status === "정상",
  },
  {
    label: "현재 세션",
    path: "/api/v1/auth/me",
    validate: (data) => typeof data?.username === "string" && typeof data?.role === "string",
  },
  {
    label: "서비스 목록",
    path: "/api/v1/services",
    validate: Array.isArray,
  },
  {
    label: "라우터 상태",
    path: "/api/v1/traefik/routers",
    validate: (data) => typeof data?.connected === "boolean" && typeof data?.domains === "object",
  },
  {
    label: "서비스 헬스",
    path: "/api/v1/services/health/all",
    validate: (data) => data && typeof data === "object" && !Array.isArray(data),
  },
  {
    label: "인증서 목록",
    path: "/api/v1/certificates",
    validate: Array.isArray,
  },
  {
    label: "시간 표시 설정",
    path: "/api/v1/settings/time-display",
    validate: (data) => typeof data?.display_timezone === "string",
  },
  {
    label: "스모크 회전 상태",
    path: "/api/v1/settings/smoke-rotation?summary=true",
    validate: (data) =>
      ["never", "running", "success", "failure"].includes(data?.status) &&
      typeof data?.is_stale === "boolean" &&
      data?.stale_after_days === 35 &&
      typeof data?.monitoring_enabled === "boolean" &&
      ["daily", "weekly"].includes(data?.monitoring_frequency) &&
      typeof data?.monitoring_admin_is_stale === "boolean" &&
      data?.monitoring_admin_stale_after_days ===
        (data?.monitoring_frequency === "weekly" ? 8 : 2),
    failureMessage: (data) =>
      data?.is_stale
        ? `스모크 계정 자동 회전이 ${data.stale_after_days}일 이상 성공하지 않았습니다`
        : null,
  },
  {
    label: "병목 이벤트 정리 미리보기",
    path: "/api/v1/settings/deployment-bottleneck-alert/cleanup",
    validate: (data) =>
      Number.isInteger(data?.retention_days) &&
      Number.isInteger(data?.deleted_count) &&
      Number.isInteger(data?.retained_event_count),
  },
  {
    label: "서비스 진단 감사 로그",
    path: "/api/v1/audit?event=service_gateway_diagnosis&limit=100&resource_type=service",
    validate: Array.isArray,
  },
];

if (process.argv.includes("--self-test")) {
  await runSelfTest();
  process.exit(0);
}

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
  let adminReadOnlyChecked = false;
  try {
    adminReadOnlyChecked = await checkOptionalSmokeAdminReadOnly(baseUrl);
  } catch (error) {
    throw new Error(`관리자 전용 점검 실패: ${error.message}`);
  }
  const chrome = await launchChrome(timeoutMs);

  try {
    const cdp = await connectToPageTarget(chrome.debugUrl, timeoutMs);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");

    for (const cookie of cookiePairs) {
      await cdp.send("Network.setCookie", { url: baseUrl, ...cookie });
    }

    await navigateAndWait(cdp, `${baseUrl}/dashboard/services`, timeoutMs);
    await waitForServicesPage(cdp, timeoutMs);

    const results = [];
    for (const check of CHECKS) {
      const result = await fetchJsonInPage(cdp, check.path);
      if (!result.ok) {
        throw new Error(`${check.label} API ${result.status}: ${result.text}`);
      }
      if (!check.validate(result.data)) {
        throw new Error(`${check.label} API 응답 형식이 예상과 다릅니다`);
      }
      const failureMessage = check.failureMessage?.(result.data);
      if (failureMessage) {
        throw new Error(failureMessage);
      }
      results.push({ ...check, data: result.data });
    }

    const visualResult = await runDashboardVisualSmoke({
      artifactDir: process.env.TM_SMOKE_ARTIFACT_DIR,
      baseUrl,
      cdp,
      timeoutMs,
    });
    if (adminReadOnlyChecked) visualResult.labels.push("관리자 읽기 전용 403");
    await recordRemoteSmokeSuccess(
      baseUrl,
      cookiePairs,
      visualResult.adminChecked || adminReadOnlyChecked,
    );

    const session = results.find((item) => item.label === "현재 세션")?.data;
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

function findCsrfCookie(cookies) {
  return cookies.find((cookie) => cookie.name.toLowerCase().includes("csrf"));
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

async function launchChrome(timeoutMs) {
  const port = await getFreePort();
  const userDataDir = await mkdtemp(join(tmpdir(), "tm-smoke-chrome-"));
  const chromeBin = process.env.TM_SMOKE_CHROME_BIN || findChromeBinary();
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ];

  if (process.getuid?.() === 0 || process.env.TM_SMOKE_NO_SANDBOX === "1") {
    args.unshift("--no-sandbox");
  }
  if (process.env.TM_SMOKE_IGNORE_CERT_ERRORS === "1") {
    args.unshift("--ignore-certificate-errors");
  }

  const processHandle = spawn(chromeBin, args, { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  processHandle.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
    stderr = stderr.slice(-4000);
  });

  const debugUrl = `http://127.0.0.1:${port}`;
  try {
    await waitForJson(`${debugUrl}/json/version`, timeoutMs);
  } catch (error) {
    processHandle.kill("SIGTERM");
    await rm(userDataDir, { force: true, recursive: true });
    throw new Error(`Chrome 시작 실패: ${error.message}${stderr ? `\n${stderr}` : ""}`);
  }

  return {
    debugUrl,
    close: async () => {
      processHandle.kill("SIGTERM");
      await waitForExit(processHandle, 2000);
      await rm(userDataDir, {
        force: true,
        maxRetries: 3,
        recursive: true,
        retryDelay: 100,
      });
    },
  };
}

async function connectToPageTarget(debugUrl, timeoutMs) {
  let response = await fetch(`${debugUrl}/json/new?about:blank`, { method: "PUT" });
  if (!response.ok) {
    response = await fetch(`${debugUrl}/json/list`);
  }
  const target = await response.json();
  const pageTarget = Array.isArray(target)
    ? target.find((item) => item.type === "page")
    : target;
  if (!pageTarget?.webSocketDebuggerUrl) {
    throw new Error("Chrome page target을 찾지 못했습니다");
  }
  return CdpClient.connect(pageTarget.webSocketDebuggerUrl, timeoutMs);
}

async function navigateAndWait(cdp, url, timeoutMs) {
  const loaded = cdp.waitFor("Page.loadEventFired", timeoutMs);
  await cdp.send("Page.navigate", { url });
  await loaded;
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

async function fetchJsonInPage(cdp, path) {
  return evaluate(
    cdp,
    `fetch(${JSON.stringify(path)}, { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const text = await response.text();
        let data = null;
        try { data = JSON.parse(text); } catch {}
        return {
          data,
          ok: response.ok,
          status: response.status,
          text: text.slice(0, 500)
        };
      })`,
  );
}

async function evaluate(cdp, expression) {
  const response = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.text || "브라우저 평가 실패");
  }
  return response.result.value;
}

class CdpClient {
  constructor(socket) {
    this.nextId = 1;
    this.pending = new Map();
    this.events = new Map();
    this.socket = socket;
    socket.addEventListener("message", (event) => this.handleMessage(event));
  }

  static async connect(url, timeoutMs) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("CDP WebSocket 연결 시간 초과")), timeoutMs);
      socket.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      });
      socket.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error("CDP WebSocket 연결 실패"));
      });
    });
    return new CdpClient(socket);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  waitFor(method, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${method} 이벤트 대기 시간 초과`));
      }, timeoutMs);
      const listeners = this.events.get(method) ?? [];
      listeners.push((params) => {
        clearTimeout(timer);
        resolve(params);
      });
      this.events.set(method, listeners);
    });
  }

  handleMessage(event) {
    const message = JSON.parse(event.data);
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result ?? {});
      return;
    }

    const listeners = this.events.get(message.method);
    if (!listeners?.length) return;
    const listener = listeners.shift();
    listener(message.params ?? {});
  }
}

async function waitForJson(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch (error) {
      lastError = error;
    }
    await sleep(200);
  }
  throw lastError ?? new Error(`${url} 응답 없음`);
}

function findChromeBinary() {
  const result = spawnSync("sh", [
    "-lc",
    "command -v google-chrome || command -v chromium || command -v chromium-browser",
  ]);
  const path = result.stdout.toString().trim().split("\n")[0];
  if (!path) {
    throw new Error("Chrome/Chromium 실행 파일을 찾지 못했습니다. TM_SMOKE_CHROME_BIN을 지정하세요.");
  }
  return path;
}

async function getFreePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForExit(processHandle, timeoutMs) {
  if (processHandle.exitCode !== null) return Promise.resolve();

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      processHandle.kill("SIGKILL");
      resolve();
    }, timeoutMs);
    processHandle.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
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
  assert.equal(findCsrfCookie([
    { name: "tm_session", value: "abc" },
    { name: "tm_csrf", value: "def" },
  ])?.value, "def");
  const rotationCheck = CHECKS.find((check) => check.label === "스모크 회전 상태");
  assert.match(rotationCheck.failureMessage({ is_stale: true, stale_after_days: 35 }), /35일/);
  assert.equal(rotationCheck.failureMessage({ is_stale: false, stale_after_days: 35 }), null);
  await runSmokeAdminReadOnlySelfTest();
  await runRemoteSmokeStatusSelfTest();
  runDashboardVisualSmokeSelfTest();
  console.log("서비스 브라우저 스모크 self-test 통과");
}
