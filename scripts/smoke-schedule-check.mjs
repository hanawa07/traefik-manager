#!/usr/bin/env node
import assert from "node:assert/strict";

if (process.argv.includes("--self-test")) {
  runSelfTest();
  process.exit(0);
}

main().catch((error) => {
  console.error(`예약 스모크 설정 확인 실패: ${error.message}`);
  process.exit(1);
});

async function main() {
  const baseUrl = resolveBaseUrl();
  const response = await fetch(`${baseUrl}/api/v1/settings/smoke-schedule-decision`);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`설정 API ${response.status}: ${text.slice(0, 200)}`);
  }

  const shouldRun = parseScheduleDecision(text);
  console.error(
    shouldRun
      ? "예약 운영 로그인·화면 스모크 실행"
      : "예약 운영 로그인·화면 스모크 건너뜀",
  );
  console.log(`should_run=${shouldRun}`);
}

export function parseScheduleDecision(text) {
  const shouldRun = JSON.parse(text)?.should_run;
  if (typeof shouldRun !== "boolean") {
    throw new Error("should_run 설정이 올바르지 않습니다");
  }
  return shouldRun;
}

function resolveBaseUrl() {
  const raw = String(process.env.TM_SMOKE_BASE_URL || "").trim();
  if (!raw) throw new Error("TM_SMOKE_BASE_URL이 필요합니다");
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withScheme.replace(/\/+$/, "");
}

function runSelfTest() {
  assert.equal(parseScheduleDecision('{"should_run":true}'), true);
  assert.equal(parseScheduleDecision('{"should_run":false}'), false);
  assert.throws(() => parseScheduleDecision('{"should_run":"yes"}'), /should_run/);
  console.log("예약 스모크 판정 self-test 통과");
}
