#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import {
  connectToSmokePage,
  evaluateInSmokePage as evaluate,
  getFreePort,
  launchSmokeChrome,
  navigateSmokePage,
} from "./smoke-browser-cdp.mjs";

const timeoutMs = 40_000;
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const route = "/visual-fixtures/traefik-update-plan";
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: new URL("../frontend/", import.meta.url),
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", VISUAL_FIXTURES_ENABLED: "1" },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverOutput = "";
for (const stream of [server.stdout, server.stderr]) {
  stream.on("data", (chunk) => { serverOutput = `${serverOutput}${chunk}`.slice(-4000); });
}
let chrome;
try {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    if (server.exitCode !== null || Date.now() > deadline) {
      throw new Error(`시각 fixture 서버 준비 실패: ${serverOutput}`);
    }
    const response = await fetch(`${baseUrl}${route}`).catch(() => null);
    if (response?.ok) break;
    await sleep(250);
  }
  chrome = await launchSmokeChrome(timeoutMs);
  const cdp = await connectToSmokePage(chrome.debugUrl, timeoutMs);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await navigateSmokePage(cdp, `${baseUrl}${route}`, timeoutMs);
  for (const width of [360, 390, 768, 1440]) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width, height: 900, deviceScaleFactor: 1, mobile: width < 768,
    });
    for (const dark of [false, true]) {
      await evaluate(cdp, `document.documentElement.classList.toggle('dark', ${dark})`);
      const snapshot = await evaluate(cdp, `(() => {
        const main = document.querySelector('main');
        const facts = [...document.querySelectorAll('[data-testid="traefik-deployment-fact"]')];
        const commands = [...document.querySelectorAll('[data-horizontal-scroll]')];
        return {
          mainWidth: main.clientWidth,
          mainScrollWidth: main.scrollWidth,
          facts: facts.map(el => ({
            right: el.getBoundingClientRect().right,
            left: el.getBoundingClientRect().left,
            value: el.querySelector('p:last-child').textContent,
          })),
          commands: commands.map(el => ({
            right: el.getBoundingClientRect().right,
            overflow: getComputedStyle(el).overflowX,
          })),
          text: main.innerText,
        };
      })()`);
      const label = `${width}px ${dark ? "dark" : "light"}`;
      if (process.env.TM_VISUAL_ARTIFACT_DIR) {
        await mkdir(process.env.TM_VISUAL_ARTIFACT_DIR, { recursive: true });
        const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
        await writeFile(join(process.env.TM_VISUAL_ARTIFACT_DIR, `update-plan-${width}-${dark ? "dark" : "light"}.png`),
          Buffer.from(screenshot.data, "base64"));
      }
      assert.match(snapshot.text, /Traefik 업데이트 영향 점검/, label);
      assert.equal(snapshot.facts.length, 3, `${label}: 정보 카드 누락`);
      assert.match(snapshot.facts[0].value, /a{64}/, `${label}: 긴 이미지 fixture 누락`);
      assert.ok(snapshot.mainScrollWidth <= snapshot.mainWidth + 1, `${label}: 숨겨진 가로 넘침 ${snapshot.mainScrollWidth - snapshot.mainWidth}px`);
      for (const fact of snapshot.facts) {
        assert.ok(fact.left >= 0 && fact.right <= width + 1, `${label}: 정보 카드가 화면을 벗어났습니다`);
      }
      assert.equal(snapshot.commands.length, 4, `${label}: 명령 카드 누락`);
      for (const command of snapshot.commands) {
        assert.equal(command.overflow, "auto", `${label}: 명령 내부 스크롤 비활성`);
        assert.ok(command.right <= width + 1, `${label}: 명령 카드가 화면을 벗어났습니다`);
      }
    }
  }
  console.log("Traefik 업데이트 카드 긴 이미지·경로 4개 너비·라이트/다크 시각 검사 통과");
} finally {
  await chrome?.close();
  server.kill("SIGTERM");
  await Promise.race([new Promise(resolve => server.once("exit", resolve)), sleep(2000)]);
  if (server.exitCode === null) server.kill("SIGKILL");
}
