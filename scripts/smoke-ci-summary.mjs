import assert from "node:assert/strict";
import { appendFile } from "node:fs/promises";

export async function writeSmokeCiSummary(result) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return false;
  await appendFile(summaryPath, `${buildSmokeCiSummary(result)}\n`, "utf8");
  return true;
}

export function buildSmokeCiSummary({
  adminReadOnlyChecked,
  apiCheckCount,
  capabilities,
  role,
  username,
  visualCheckCount,
}) {
  const managementExpectation = capabilities.canManage
    ? "서비스·설정·사용자 관리 기능 표시"
    : "서비스·설정·사용자 관리 기능 숨김";
  const adminResult = adminReadOnlyChecked ? "통과" : "미실행";
  return [
    "### 역할별 운영 스모크 결과",
    "",
    "| 점검 세션 | 감지 역할 | 기대값 | 결과 |",
    "| --- | --- | --- | --- |",
    `| ${markdownCell(username)} | ${markdownCell(role)} | ${managementExpectation} | 통과 |`,
    `| 운영 API | ${markdownCell(role)} | ${apiCheckCount}개 API 응답 | 통과 |`,
    `| 운영 화면 | ${markdownCell(role)} | ${visualCheckCount}개 화면·상호작용 | 통과 |`,
    `| 관리자 보조 점검 | admin | 읽기 전용 환경의 쓰기 요청 403 | ${adminResult} |`,
  ].join("\n");
}

function markdownCell(value) {
  return String(value).replaceAll("|", "\\|").replace(/[\r\n]+/g, " ");
}

export function runSmokeCiSummarySelfTest() {
  const summary = buildSmokeCiSummary({
    adminReadOnlyChecked: true,
    apiCheckCount: 11,
    capabilities: { canManage: false },
    role: "viewer",
    username: "smoke|viewer",
    visualCheckCount: 9,
  });
  assert.match(summary, /smoke\\\|viewer \| viewer \| 서비스·설정·사용자 관리 기능 숨김 \| 통과/);
  assert.match(summary, /운영 API \| viewer \| 11개 API 응답 \| 통과/);
  assert.match(summary, /관리자 보조 점검 \| admin \| 읽기 전용 환경의 쓰기 요청 403 \| 통과/);
}
