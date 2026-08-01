import assert from "node:assert/strict";

import { evaluate } from "./dashboard-visual-runtime.mjs";

export async function assertAuditFilterLayout(cdp, mobile) {
  const labels = ["감사 기간", "감사 시작일", "감사 종료일", "Manager 소스", "Manager 상태", "Manager 집계 기간", "전송 상태", "알림 채널"];
  const snapshot = await evaluate(cdp, `(() => {
    const fields = ${JSON.stringify(labels)}.map((name) => {
      const field = document.querySelector('[aria-label="' + name + '"]');
      const label = field?.closest('label');
      const rect = label?.getBoundingClientRect();
      return rect ? { top: Math.round(rect.top), width: rect.width } : null;
    }).filter(Boolean);
    const searchRect = document.querySelector('input[aria-label="감사 로그 검색"]')
      ?.closest('label')?.getBoundingClientRect();
    const resetRect = document.querySelector('button[aria-label="감사 필터 전체 초기화"]')
      ?.getBoundingClientRect();
    return {
      documentWidth: document.documentElement.scrollWidth,
      fields,
      resetWidth: resetRect?.width || 0,
      searchWidth: searchRect?.width || 0,
      viewportWidth: window.innerWidth,
    };
  })()`);
  assert.equal(snapshot.fields.length, labels.length, "감사 로그 필터 필드가 누락됐습니다");
  assert.ok(
    snapshot.documentWidth <= snapshot.viewportWidth + 1,
    "감사 로그 필터가 화면 너비를 넘습니다",
  );
  const rowCount = new Set(snapshot.fields.map((field) => field.top)).size;
  if (mobile) {
    assert.equal(rowCount, labels.length, "모바일 감사 로그 필터가 한 열로 배치되지 않았습니다");
    assert.ok(
      snapshot.fields.every((field) => field.width >= snapshot.viewportWidth * 0.8),
      "모바일 감사 로그 필터 너비가 너무 좁습니다",
    );
    assert.ok(
      snapshot.searchWidth >= snapshot.viewportWidth * 0.8 &&
        snapshot.resetWidth >= snapshot.viewportWidth * 0.8,
      "모바일 감사 로그 검색과 초기화 버튼 너비가 너무 좁습니다",
    );
  } else {
    assert.equal(rowCount, 2, "데스크톱 감사 로그 필터가 네 열로 배치되지 않았습니다");
  }
}
