import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

const DAY_MS = 24 * 60 * 60 * 1_000;

export function buildManagerDeploymentBottleneckAlertFixture() {
  const occurredAt = (daysAgo) => new Date(Date.now() - daysAgo * DAY_MS).toISOString();
  return {
    status: "alerted",
    configured_threshold_ms: 60_000,
    configured_consecutive_count: 3,
    configured_event_retention_days: 90,
    effective_threshold_ms: 60_000,
    effective_consecutive_count: 3,
    effective_event_retention_days: 30,
    threshold_source: "settings",
    consecutive_source: "settings",
    event_retention_source: "environment",
    current_consecutive_count: 3,
    checked_at: occurredAt(0),
    latest_version: "v1.38.71",
    slowest_stage: "build",
    slowest_ms: 75_000,
    alerted_at: occurredAt(0),
    run_url: null,
    run_status: null,
    run_conclusion: null,
    run_checked_at: null,
    run_error: null,
    events: [
      buildEvent("alerted", occurredAt(0), "v1.38.71", "build", 75_000, 3),
      buildEvent("cleared", occurredAt(2), "v1.38.70", null, 0, 0),
      buildEvent("alerted", occurredAt(10), "+v1.38.61", "public_probe", 90_000, 3),
    ],
  };
}

export async function checkManagerDeploymentBottleneckEvents({ cdp, reload, timeoutMs }) {
  const opened = await evaluate(cdp, `(() => {
    const details = document.querySelector('[data-manager-deployment-bottleneck-events]');
    details?.querySelector('summary')?.click();
    return Boolean(details);
  })()`);
  assert.equal(opened, true, "Manager 배포 병목 발생·해제 이력을 찾지 못했습니다");
  await waitForEventCount(cdp, 3, timeoutMs, "전체 병목 이력이 표시되지 않았습니다");

  await setEventPeriod({ cdp, period: "7", timeoutMs });
  await waitForEventCount(cdp, 2, timeoutMs, "최근 7일 병목 이력 필터가 적용되지 않았습니다");
  await clickEventFilter({ cdp, event: "cleared", expectedCount: 1, timeoutMs });
  await reload();
  await waitForCondition(
    cdp,
    `document.querySelector('[data-bottleneck-event-period]')?.value === '7' &&
      document.querySelector('[data-bottleneck-event-filter="cleared"]')?.getAttribute('aria-pressed') === 'true'`,
    timeoutMs,
    "Manager 병목 이력 URL 조건이 새로고침 후 복원되지 않았습니다",
  );
  await waitForEventCount(cdp, 1, timeoutMs, "복원된 병목 이력 조건이 결과에 적용되지 않았습니다");

  const json = await captureEventDownload(cdp, "json");
  assert.match(json.filename, /bottleneck-events-cleared-7d-\d{4}-\d{2}-\d{2}\.json$/);
  const payload = JSON.parse(json.text);
  assert.equal(payload.metadata.schema_version, 1);
  assert.equal(payload.metadata.result_count, 1);
  assert.deepEqual(payload.metadata.filters, { event: "cleared", period: "7" });
  assert.equal(payload.events[0].event, "cleared");
  await waitForExportNotice(cdp, "JSON", json.filename, timeoutMs);

  await clickEventFilter({ cdp, event: "all", expectedCount: 2, timeoutMs });
  await setEventPeriod({ cdp, period: "all", timeoutMs });
  await waitForEventCount(cdp, 3, timeoutMs, "전체 기간 병목 이력이 복원되지 않았습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const params = new URLSearchParams(location.search);
      return !params.has('deployment_bottleneck_event_type') &&
        !params.has('deployment_bottleneck_event_period');
    })()`,
    timeoutMs,
    "Manager 병목 이력 URL 조건을 초기화하지 못했습니다",
  );
  const csv = await captureEventDownload(cdp, "csv");
  assert.match(csv.filename, /bottleneck-events-all-all-time-\d{4}-\d{2}-\d{2}\.csv$/);
  assert.deepEqual(csv.bytes, [239, 187, 191], "Manager 병목 CSV UTF-8 BOM이 없습니다");
  assert.match(csv.text, /^metadata,value\r\n/);
  assert.match(csv.text, /\r\nresult_count,"3"\r\n/);
  assert.match(csv.text, /\r\nfilter_event,"all"\r\n/);
  assert.match(csv.text, /\r\nfilter_period,"all"\r\n/);
  assert.match(csv.text, /\r\n\r\nevent,occurred_at,threshold_ms,/);
  assert.match(csv.text, /"'\+v1\.38\.61"/);
  await waitForExportNotice(cdp, "CSV", csv.filename, timeoutMs);
}

function buildEvent(event, occurredAt, latestVersion, slowestStage, slowestMs, currentCount) {
  return {
    event,
    occurred_at: occurredAt,
    threshold_ms: 60_000,
    required_consecutive_count: 3,
    current_consecutive_count: currentCount,
    latest_version: latestVersion,
    slowest_stage: slowestStage,
    slowest_ms: slowestMs,
    run_url: null,
  };
}

async function setEventPeriod({ cdp, period, timeoutMs }) {
  const changed = await evaluate(cdp, `(() => {
    const select = document.querySelector('[data-bottleneck-event-period]');
    if (!(select instanceof HTMLSelectElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    setter?.call(select, ${JSON.stringify(period)});
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, "Manager 병목 이력 기간을 선택하지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const expected = ${JSON.stringify(period)};
      const params = new URLSearchParams(location.search);
      return document.querySelector('[data-bottleneck-event-period]')?.value === expected &&
        (expected === 'all'
          ? !params.has('deployment_bottleneck_event_period')
          : params.get('deployment_bottleneck_event_period') === expected);
    })()`,
    timeoutMs,
    `Manager 병목 이력 ${period} 기간 선택이 반영되지 않았습니다`,
  );
}

async function clickEventFilter({ cdp, event, expectedCount, timeoutMs }) {
  const clicked = await evaluate(cdp, `(() => {
    const button = document.querySelector(${JSON.stringify(`[data-bottleneck-event-filter="${event}"]`)});
    button?.click();
    return Boolean(button);
  })()`);
  assert.equal(clicked, true, `Manager 병목 ${event} 필터를 찾지 못했습니다`);
  await waitForCondition(
    cdp,
    `(() => {
      const expected = ${JSON.stringify(event)};
      const params = new URLSearchParams(location.search);
      return document.querySelector('[data-bottleneck-event-filter=${JSON.stringify(event)}]')?.getAttribute('aria-pressed') === 'true' &&
        (expected === 'all'
          ? !params.has('deployment_bottleneck_event_type')
          : params.get('deployment_bottleneck_event_type') === expected);
    })()`,
    timeoutMs,
    `Manager 병목 ${event} 필터가 선택되지 않았습니다`,
  );
  await waitForEventCount(cdp, expectedCount, timeoutMs, `Manager 병목 ${event} 필터가 적용되지 않았습니다`);
}

async function waitForEventCount(cdp, count, timeoutMs, message) {
  await waitForCondition(
    cdp,
    `document.querySelectorAll('[data-manager-deployment-bottleneck-event]').length === ${count} &&
      document.querySelector('[data-bottleneck-event-export-notice]')?.textContent?.includes('현재 결과 ${count}건')`,
    timeoutMs,
    message,
  );
}

async function waitForExportNotice(cdp, format, filename, timeoutMs) {
  await waitForCondition(
    cdp,
    `document.querySelector('[data-bottleneck-event-export-notice]')?.textContent?.includes(${JSON.stringify(`${format} 내보내기 완료 · ${filename}`)})`,
    timeoutMs,
    `Manager 병목 ${format} 내보내기 완료 표시가 올바르지 않습니다`,
  );
}

async function captureEventDownload(cdp, format) {
  const result = await evaluate(cdp, `(async () => {
    const button = document.querySelector(${JSON.stringify(`[data-bottleneck-event-export="${format}"]`)});
    if (!button) return null;
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    const originalClick = HTMLAnchorElement.prototype.click;
    let blob = null;
    let filename = '';
    try {
      URL.createObjectURL = (value) => { blob = value; return 'blob:bottleneck-events-smoke'; };
      URL.revokeObjectURL = () => {};
      HTMLAnchorElement.prototype.click = function () { filename = this.download; };
      button.click();
      if (!blob) return null;
      const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()).slice(0, 3));
      return { bytes, filename, text: await blob.text() };
    } finally {
      URL.createObjectURL = originalCreateObjectUrl;
      URL.revokeObjectURL = originalRevokeObjectUrl;
      HTMLAnchorElement.prototype.click = originalClick;
    }
  })()`);
  assert.ok(result, `Manager 병목 ${format.toUpperCase()} 내보내기를 캡처하지 못했습니다`);
  return result;
}
