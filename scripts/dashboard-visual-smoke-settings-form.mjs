import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";
import { fulfillJsonRequest } from "./dashboard-visual-smoke-history-fixture.mjs";

export async function checkRemoteSmokeSettingsForm({ cdp, fixture, timeoutMs }) {
  const opened = await evaluate(cdp, `(() => {
    const card = document.querySelector('[data-testid="smoke-rotation-status-card"]');
    const edit = Array.from(card?.querySelectorAll('button') || [])
      .find((button) => button.textContent?.trim() === '편집');
    edit?.click();
    return Boolean(edit);
  })()`);
  assert.equal(opened, true, "원격 운영 점검 설정 편집 버튼이 표시되지 않았습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const card = document.querySelector('[data-testid="smoke-rotation-status-card"]');
      const frequency = card?.querySelector('#smoke-monitoring-frequency');
      const enabled = Array.from(card?.querySelectorAll('label') || [])
        .find((label) => label.textContent?.includes('예약 자동 점검 사용'))
        ?.querySelector('input[type="checkbox"]');
      const save = Array.from(card?.querySelectorAll('button') || [])
        .find((button) => button.textContent?.trim() === '저장');
      return frequency instanceof HTMLSelectElement && !frequency.disabled &&
        enabled instanceof HTMLInputElement && !enabled.disabled &&
        save instanceof HTMLButtonElement && !save.disabled;
    })()`,
    timeoutMs,
    "원격 운영 점검 설정 입력이 활성화되지 않았습니다",
  );

  const updatedFrequency = fixture.monitoring_frequency === "daily" ? "weekly" : "daily";
  const changed = await evaluate(cdp, `(() => {
    const select = document.querySelector('#smoke-monitoring-frequency');
    if (!(select instanceof HTMLSelectElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    setter?.call(select, ${JSON.stringify(updatedFrequency)});
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return select.value === ${JSON.stringify(updatedFrequency)};
  })()`);
  assert.equal(changed, true, "원격 운영 점검 예약 주기를 변경하지 못했습니다");

  const expected = {
    monitoring_enabled: fixture.monitoring_enabled,
    monitoring_frequency: updatedFrequency,
    monitoring_failure_rate_threshold_percent: fixture.monitoring_failure_rate_threshold_percent,
    monitoring_failure_rate_min_runs: fixture.monitoring_failure_rate_min_runs,
    monitoring_failure_rate_window_days: fixture.monitoring_failure_rate_window_days,
    monitoring_failure_type_alert_enabled: fixture.monitoring_failure_type_alert_enabled,
    monitoring_failure_metadata_limit: fixture.monitoring_failure_metadata_limit,
    monitoring_github_rate_limit_alert_enabled: fixture.monitoring_github_rate_limit_alert_enabled,
    monitoring_github_primary_limit_alert_threshold: fixture.monitoring_github_primary_limit_alert_threshold,
    monitoring_github_secondary_limit_alert_threshold: fixture.monitoring_github_secondary_limit_alert_threshold,
    monitoring_github_rate_limit_alert_window_hours: fixture.monitoring_github_rate_limit_alert_window_hours,
  };
  const updateRequest = cdp.waitFor("Fetch.requestPaused", timeoutMs);
  const saved = await evaluate(cdp, `(() => {
    const card = document.querySelector('[data-testid="smoke-rotation-status-card"]');
    const save = Array.from(card?.querySelectorAll('button') || [])
      .find((button) => button.textContent?.trim() === '저장');
    save?.click();
    return Boolean(save);
  })()`);
  assert.equal(saved, true, "원격 운영 점검 설정 저장 버튼을 누르지 못했습니다");
  const update = await updateRequest;
  assert.equal(update.request.method, "PUT");
  assert.equal(new URL(update.request.url).pathname, "/api/v1/settings/smoke-rotation");
  assert.deepEqual(JSON.parse(update.request.postData || "{}"), expected);
  assert.ok(
    Object.keys(update.request.headers).some((name) => name.toLowerCase() === "x-csrf-token"),
    "원격 운영 점검 설정 저장 요청에 CSRF 헤더가 없습니다",
  );

  const savedFixture = { ...fixture, ...expected };
  const refreshRequest = cdp.waitFor("Fetch.requestPaused", timeoutMs);
  await fulfillJsonRequest(cdp, update, savedFixture);
  const refresh = await refreshRequest;
  assert.equal(refresh.request.method, "GET");
  await fulfillJsonRequest(cdp, refresh, savedFixture);
  const expectedLabel = updatedFrequency === "daily" ? "매일" : "매주 일요일";
  await waitForCondition(
    cdp,
    `(() => {
      const card = document.querySelector('[data-testid="smoke-rotation-status-card"]');
      const edit = Array.from(card?.querySelectorAll('button') || [])
        .find((button) => button.textContent?.trim() === '편집');
      return edit instanceof HTMLButtonElement &&
        !card?.querySelector('#smoke-monitoring-frequency') &&
        card?.textContent?.includes(${JSON.stringify(expectedLabel)}) &&
        document.body.innerText.includes('운영 로그인·화면 점검 설정 저장 완료');
    })()`,
    timeoutMs,
    "원격 운영 점검 설정 저장 결과가 요약에 반영되지 않았습니다",
  );
  return savedFixture;
}
