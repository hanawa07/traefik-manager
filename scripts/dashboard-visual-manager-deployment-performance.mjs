import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

export async function checkManagerDeploymentPerformance({ cdp, timeoutMs }) {
  const snapshot = await evaluate(cdp, `(() => {
    const stagePerformance = (stage) => {
      const row = document.querySelector('[data-stage-performance="' + stage + '"]');
      return {
        alert: row?.getAttribute('data-stage-alert'),
        average: row?.getAttribute('data-stage-average-ms'),
        count: row?.getAttribute('data-stage-count'),
        max: row?.getAttribute('data-stage-max-ms'),
        p95: row?.getAttribute('data-stage-p95-ms'),
      };
    };
    return {
      alertCount: document.querySelector('[data-deployment-stage-alert-count]')?.getAttribute(
        'data-deployment-stage-alert-count',
      ),
      alertDetails: document.querySelectorAll('[data-deployment-bottleneck-alert="true"]').length,
      bars: Array.from(document.querySelectorAll('[data-deployment-duration-bar]')).map((bar) => ({
        duration: bar.getAttribute('data-deployment-duration-bar'),
        version: bar.getAttribute('data-deployment-version'),
      })),
      bottlenecks: Array.from(document.querySelectorAll('[data-deployment-bottleneck]')).map(
        (details) => ({
          stage: details.getAttribute('data-deployment-bottleneck'),
          summary: details.querySelector('summary')?.textContent?.replace(/\\s+/g, ' ').trim(),
          timings: details.querySelectorAll('[data-deployment-stage-duration]').length,
        }),
      ),
      build: stagePerformance('build'),
      publicProbe: stagePerformance('public_probe'),
    };
  })()`);
  assert.deepEqual(snapshot.bars, [
    { duration: "120000", version: "v1.38.69" },
    { duration: "60000", version: "v1.38.70" },
    { duration: "30000", version: "v1.38.71" },
  ]);
  assert.deepEqual(snapshot.bottlenecks, [
    { stage: "build", summary: "단계 병목 · 이미지 빌드 10초", timings: 8 },
    { stage: "public_probe", summary: "단계 병목 · 공개 health probe 18초", timings: 8 },
    { stage: "build", summary: "병목 경고 · 이미지 빌드 1분 50초", timings: 2 },
  ]);
  assert.equal(snapshot.alertCount, "1");
  assert.equal(snapshot.alertDetails, 1);
  assert.deepEqual(snapshot.build, {
    alert: "true",
    average: "44000",
    count: "3",
    max: "110000",
    p95: "100200",
  });
  assert.deepEqual(snapshot.publicProbe, {
    alert: "false",
    average: "10500",
    count: "2",
    max: "18000",
    p95: "17250",
  });

  await selectBottleneckThreshold({ cdp, expectedAlerts: 2, timeoutMs, value: "15000" });
  await selectBottleneckThreshold({ cdp, expectedAlerts: 1, timeoutMs, value: "60000" });
}

export async function checkManagerDeploymentPeriodComparison(cdp) {
  const comparison = await evaluate(cdp, `(() => {
    const item = document.querySelector('[data-deployment-period-comparison="available"]');
    return {
      count: item?.getAttribute('data-previous-period-count'),
      current: item?.getAttribute('data-current-period-average-ms'),
      delta: item?.getAttribute('data-period-delta-percent'),
      previous: item?.getAttribute('data-previous-period-average-ms'),
      text: item?.textContent?.replace(/\\s+/g, ' ').trim(),
    };
  })()`);
  assert.deepEqual(comparison, {
    count: "1",
    current: "60000",
    delta: "-50",
    previous: "120000",
    text: "직전 동일 기간 평균 2분 · 현재 평균 1분 (50% 단축)",
  });
}

async function selectBottleneckThreshold({ cdp, expectedAlerts, timeoutMs, value }) {
  const changed = await evaluate(cdp, `(() => {
    const select = document.querySelector('[data-deployment-bottleneck-threshold]');
    if (!(select instanceof HTMLSelectElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    setter?.call(select, ${JSON.stringify(value)});
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, "Manager 병목 경고 기준을 선택하지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const params = new URLSearchParams(location.search);
      const alertCount = document.querySelector('[data-deployment-stage-alert-count]')?.getAttribute(
        'data-deployment-stage-alert-count',
      );
      const condition = document.querySelector('[data-history-condition="bottleneck_threshold"]');
      return alertCount === ${JSON.stringify(String(expectedAlerts))} &&
        document.querySelectorAll('[data-deployment-bottleneck-alert="true"]').length === ${expectedAlerts} &&
        ${value === "60000"
          ? "!params.has('deployment_bottleneck_ms') && !condition"
          : `params.get('deployment_bottleneck_ms') === ${JSON.stringify(value)} && condition?.textContent?.includes('15초')`};
    })()`,
    timeoutMs,
    `Manager 병목 경고 ${value}ms 기준이 반영되지 않았습니다`,
  );
}
