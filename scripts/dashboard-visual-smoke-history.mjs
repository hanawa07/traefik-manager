import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

const RUN_URL = "https://github.com/hanawa07/traefik-manager/actions/runs/987";
const ARTIFACT_URL = `${RUN_URL}/artifacts/654`;

export async function checkSmokeRecentRunArtifact({ cdp, timeoutMs }) {
  const fixture = await evaluate(cdp, `(async () => {
    const response = await fetch('/api/v1/settings/smoke-rotation');
    if (!response.ok) return null;
    const status = await response.json();
    const failedRun = {
      status: 'failure',
      completed_at: '2026-07-20T06:00:00Z',
      run_url: ${JSON.stringify(RUN_URL)},
      run_number: 987,
      commit_sha: 'abcdef0',
      summary: '실패 단계: 운영 로그인·화면 검사',
      notification_suppressed: false,
      artifact_url: ${JSON.stringify(ARTIFACT_URL)},
      artifact_expires_at: '2026-07-27T06:00:00Z',
    };
    return {
      ...status,
      monitoring_latest_failure: failedRun,
      monitoring_recent_runs: [failedRun],
    };
  })()`);
  assert.ok(fixture, "운영 점검 최근 이력 fixture의 기본 응답을 읽지 못했습니다");

  await cdp.send("Fetch.enable", {
    patterns: [{
      requestStage: "Request",
      urlPattern: "*/api/v1/settings/smoke-rotation",
    }],
  });
  try {
    const requestPaused = cdp.waitFor("Fetch.requestPaused", timeoutMs);
    const loaded = cdp.waitFor("Page.loadEventFired", timeoutMs);
    await cdp.send("Page.reload", { ignoreCache: true });
    const request = await requestPaused;
    await cdp.send("Fetch.fulfillRequest", {
      requestId: request.requestId,
      responseCode: 200,
      responseHeaders: [{ name: "Content-Type", value: "application/json" }],
      body: Buffer.from(JSON.stringify(fixture)).toString("base64"),
    });
    await loaded;
    await waitForCondition(
      cdp,
      `(() => {
        const history = document.querySelector('[data-testid="smoke-recent-run-history"]');
        if (history instanceof HTMLDetailsElement) history.open = true;
        const artifact = history?.querySelector('[data-testid="smoke-recent-run-artifact-link"]');
        const run = history?.querySelector('a[href="${RUN_URL}"]');
        return history?.open && artifact?.href === ${JSON.stringify(ARTIFACT_URL)} &&
          artifact.textContent?.includes('실패 화면') && run?.textContent?.includes('#987');
      })()`,
      timeoutMs,
      "최근 운영 점검 이력에 실패 화면 Artifact 링크가 표시되지 않았습니다",
    );
  } finally {
    await cdp.send("Fetch.disable");
  }
}
