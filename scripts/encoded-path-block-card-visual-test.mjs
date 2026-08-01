#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  connectToSmokePage,
  evaluateInSmokePage,
  getFreePort,
  launchSmokeChrome,
  navigateSmokePage,
} from "./smoke-browser-cdp.mjs";

const TIMEOUT_MS = 40_000;
const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const frontendDirectory = join(repositoryRoot, "frontend");
assert.ok(
  existsSync(join(frontendDirectory, ".next", "BUILD_ID")),
  "시각 검사 전에 frontend production build가 필요합니다",
);
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const route = "/visual-fixtures/encoded-path-block";
const server = startFrontend(port);
let chrome;

try {
  await waitForFixture(`${baseUrl}${route}`, server);
  chrome = await launchSmokeChrome(TIMEOUT_MS);
  const cdp = await connectToSmokePage(chrome.debugUrl, TIMEOUT_MS);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: "dark" }],
  });
  await navigateSmokePage(cdp, `${baseUrl}${route}`, TIMEOUT_MS);

  const snapshot = await evaluateInSmokePage(cdp, `(() => {
    const card = document.querySelector('[data-visual-fixture] .card');
    const trend = document.querySelector('[data-testid="encoded-path-block-trend"]');
    const bars = [...document.querySelectorAll('[data-block-count]')];
    const heading = card?.querySelector('h2');
    const rect = card?.getBoundingClientRect();
    return {
      activeBars: bars.filter((bar) => Number(bar.dataset.blockCount) > 0).length,
      backgroundColor: card ? getComputedStyle(card).backgroundColor : null,
      barCount: bars.length,
      cardLeft: rect?.left ?? -1,
      cardRight: rect?.right ?? 9999,
      headingColor: heading ? getComputedStyle(heading).color : null,
      href: location.pathname,
      scrollWidth: document.documentElement.scrollWidth,
      text: document.body.innerText,
      trendVisible: Boolean(trend),
      viewportWidth: innerWidth,
    };
  })()`);

  assert.equal(snapshot.href, route, "인증 화면으로 이동했습니다");
  assert.match(snapshot.text, /인코딩 경로 차단/);
  assert.match(snapshot.text, /최근 24시간 영속 집계/);
  assert.match(snapshot.text, /11건/);
  assert.equal(snapshot.trendVisible, true);
  assert.equal(snapshot.barCount, 24);
  assert.ok(snapshot.activeBars >= 6, "차단 추이 fixture가 비어 있습니다");
  assert.ok(snapshot.scrollWidth <= snapshot.viewportWidth, "모바일에서 가로 넘침이 발생했습니다");
  assert.ok(snapshot.cardLeft >= 0 && snapshot.cardRight <= 390, "카드가 모바일 화면을 벗어났습니다");
  assert.notEqual(snapshot.backgroundColor, "rgb(255, 255, 255)", "카드 다크 배경이 적용되지 않았습니다");
  assert.notEqual(snapshot.headingColor, snapshot.backgroundColor, "제목과 배경 색상이 같습니다");

  const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
  assert.ok(screenshot.data?.length > 1000, "모바일 다크 스크린샷 생성에 실패했습니다");
  console.log("인코딩 경로 차단 카드 인증 없는 모바일 다크 시각 검사 통과");
} finally {
  await chrome?.close();
  await stopProcess(server);
}

function startFrontend(serverPort) {
  const child = spawn(
    "npm",
    ["run", "start", "--", "--hostname", "127.0.0.1", "--port", String(serverPort)],
    {
      cwd: frontendDirectory,
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: "1",
        VISUAL_FIXTURES_ENABLED: "1",
      },
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  for (const stream of [child.stdout, child.stderr]) {
    stream.on("data", (chunk) => {
      output = `${output}${chunk}`.slice(-4000);
    });
  }
  child.getOutput = () => output;
  return child;
}

async function waitForFixture(url, processHandle) {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) {
      throw new Error(`Next 개발 서버가 종료되었습니다.\n${processHandle.getOutput()}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`시각 fixture 응답 대기 시간 초과\n${processHandle.getOutput()}`);
}

async function stopProcess(processHandle) {
  if (processHandle.exitCode !== null) return;
  signalProcessGroup(processHandle, "SIGTERM");
  await Promise.race([
    new Promise((resolve) => processHandle.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ]);
  if (processHandle.exitCode === null) signalProcessGroup(processHandle, "SIGKILL");
}

function signalProcessGroup(processHandle, signal) {
  try {
    process.kill(-processHandle.pid, signal);
  } catch {
    processHandle.kill(signal);
  }
}
