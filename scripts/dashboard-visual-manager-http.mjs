import assert from "node:assert/strict";

import { evaluate } from "./dashboard-visual-runtime.mjs";

export async function checkManagerHttpErrorTrend({ cdp }) {
  const snapshot = await evaluate(cdp, `(() => {
    const card = document.querySelector('[data-testid="manager-http-error-trend"]');
    const chart = document.querySelector('[data-testid="manager-http-error-chart-scroll"]');
    return card ? {
      available: card.getAttribute('data-http-error-available'),
      bucketCount: card.querySelectorAll('[data-http-error-bucket="true"]').length,
      chartScrollWidth: chart?.scrollWidth ?? 0,
      chartWidth: chart?.clientWidth ?? 0,
      text: card.textContent || '',
    } : null;
  })()`);

  assert.ok(snapshot, "Manager API 오류 추이 카드를 찾지 못했습니다");
  assert.equal(snapshot.available, "true", "Manager API 오류 로그를 조회하지 못했습니다");
  assert.equal(snapshot.bucketCount, 24, "Manager API 오류 추이가 24개 시간 구간이 아닙니다");
  assert.ok(snapshot.chartScrollWidth >= snapshot.chartWidth, "Manager API 오류 차트 폭이 올바르지 않습니다");
  assert.match(snapshot.text, /관측 시작:/, "Manager API 오류 로그 관측 시각이 없습니다");
}
