import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  runDashboardVisualSmoke as runDashboardVisualSmokeBase,
  runDashboardVisualSmokeSelfTest as runDashboardVisualSmokeBaseSelfTest,
} from "./dashboard-visual-smoke.mjs";
import { writeVisualFailureMetadata } from "./dashboard-visual-artifacts.mjs";

export async function runDashboardVisualSmoke(options) {
  try {
    return await runDashboardVisualSmokeBase(options);
  } catch (error) {
    const message = String(error?.message || "알 수 없는 오류");
    await writeVisualFailureMetadata({
      artifactDir: options.artifactDir,
      cdp: options.cdp,
      message,
    }).catch(() => undefined);
    throw error;
  }
}

export async function runDashboardVisualSmokeSelfTest() {
  runDashboardVisualSmokeBaseSelfTest();
  const artifactDir = await mkdtemp(join(tmpdir(), "traefik-smoke-metadata-"));
  try {
    await writeVisualFailureMetadata({
      artifactDir,
      cdp: {
        send: async () => ({
          result: { value: { path: "/dashboard/settings", title: "설정" } },
        }),
      },
      message: "설정 화면 검사 실패",
    });
    const metadata = JSON.parse(await readFile(join(artifactDir, "failure-metadata.json"), "utf8"));
    assert.equal(metadata.check_name, "설정 화면 검사 실패");
    assert.equal(metadata.screen_path, "/dashboard/settings");
    assert.equal(metadata.page_title, "설정");
    assert.match(metadata.captured_at, /^\d{4}-\d{2}-\d{2}T/);
    await writeVisualFailureMetadata({
      artifactDir,
      cdp: {
        send: async () => {
          throw new Error("CDP 연결 종료");
        },
      },
      message: "브라우저 연결 실패",
    });
    const fallback = JSON.parse(await readFile(join(artifactDir, "failure-metadata.json"), "utf8"));
    assert.equal(fallback.check_name, "브라우저 연결 실패");
    assert.equal(fallback.screen_path, null);
    await writeVisualFailureMetadata({
      artifactDir,
      message: "실패 알림 경로 점검",
      page: { path: null, title: "failure notification test" },
    });
    const synthetic = JSON.parse(await readFile(join(artifactDir, "failure-metadata.json"), "utf8"));
    assert.equal(synthetic.check_name, "실패 알림 경로 점검");
    assert.equal(synthetic.page_title, "failure notification test");
  } finally {
    await rm(artifactDir, { force: true, recursive: true });
  }
}
