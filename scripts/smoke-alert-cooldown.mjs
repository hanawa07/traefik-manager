#!/usr/bin/env node
import assert from "node:assert/strict";

const COOLDOWN_MS = 6 * 60 * 60 * 1000;

if (process.argv.includes("--self-test")) {
  runSelfTest();
  process.exit(0);
}

main().catch((error) => {
  console.error(`실패 알림 cooldown 확인 실패, 알림 전송 유지: ${error.message}`);
  console.log("suppress=false");
});

async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;
  const headSha = process.env.GITHUB_SHA;
  const token = process.env.GH_TOKEN;
  if (!repository || !runId || !headSha || !token) {
    throw new Error("GitHub Actions 실행 정보가 부족합니다");
  }

  const url =
    `https://api.github.com/repos/${repository}/actions/workflows/` +
    "dashboard-visual-smoke.yml/runs?status=failure&per_page=20";
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "user-agent": "traefik-manager-smoke-cooldown",
      "x-github-api-version": "2022-11-28",
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub Actions API ${response.status}`);
  }

  const payload = await response.json();
  const suppress = shouldSuppressFailureAlert(payload.workflow_runs, {
    currentRunId: runId,
    headSha,
    now: new Date(),
  });
  console.error(
    suppress
      ? "동일 커밋 실패 알림이 최근 6시간 내 전송되어 Telegram을 억제합니다"
      : "최근 6시간 내 동일 커밋 실패 알림이 없어 Telegram을 전송합니다",
  );
  console.log(`suppress=${suppress}`);
}

export function shouldSuppressFailureAlert(runs, { currentRunId, headSha, now }) {
  return (Array.isArray(runs) ? runs : []).some((run) => {
    if (
      String(run.id) === String(currentRunId) ||
      run.head_sha !== headSha ||
      String(run.display_title || "").startsWith("[테스트]")
    ) return false;
    const completedAt = new Date(run.updated_at || run.created_at).getTime();
    const age = now.getTime() - completedAt;
    return run.conclusion === "failure" && age >= 0 && age <= COOLDOWN_MS;
  });
}

function runSelfTest() {
  const now = new Date("2026-07-11T12:00:00Z");
  const recent = {
    id: 1,
    head_sha: "abc",
    conclusion: "failure",
    display_title: "운영 로그인·화면 스모크",
    updated_at: "2026-07-11T10:00:00Z",
  };
  const old = { ...recent, id: 2, updated_at: "2026-07-11T05:00:00Z" };
  assert.equal(shouldSuppressFailureAlert([recent], { currentRunId: 9, headSha: "abc", now }), true);
  assert.equal(shouldSuppressFailureAlert([old], { currentRunId: 9, headSha: "abc", now }), false);
  assert.equal(shouldSuppressFailureAlert([recent], { currentRunId: 9, headSha: "def", now }), false);
  assert.equal(shouldSuppressFailureAlert([recent], { currentRunId: 1, headSha: "abc", now }), false);
  assert.equal(shouldSuppressFailureAlert([
    { ...recent, display_title: "[테스트] 운영 로그인·화면 스모크" },
  ], { currentRunId: 9, headSha: "abc", now }), false);
  console.log("스모크 실패 알림 cooldown self-test 통과");
}
