import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";
import { checkManagerDeploymentHistoryActions } from "./dashboard-visual-manager-deployment-actions.mjs";
import {
  checkManagerDeploymentArchiveSamples,
  readManagerDeploymentFixtureSource,
} from "./dashboard-visual-manager-deployment-archive.mjs";
import { checkManagerDeploymentHistoryExports } from "./dashboard-visual-manager-deployment-export.mjs";
import {
  buildManagerDeploymentBottleneckAlertFixture,
  checkManagerDeploymentBottleneckEvents,
} from "./dashboard-visual-manager-deployment-bottleneck.mjs";
import {
  checkHistorySearchAndFilters,
  waitForHistoryQueryRestore,
} from "./dashboard-visual-manager-deployment-query.mjs";

const FIXTURE_NOW = Date.now();
const DAY_MS = 24 * 60 * 60 * 1_000;

function fixtureTimestamp(daysAgo, extraMilliseconds = 0) {
  return new Date(FIXTURE_NOW - daysAgo * DAY_MS - extraMilliseconds).toISOString();
}

const CURRENT_FIXTURE_ENTRIES = [
  {
    status: "success",
    from_slot: "green",
    to_slot: "blue",
    active_slot: "blue",
    version: "v1.38.71",
    revision: "c".repeat(40),
    started_at: fixtureTimestamp(1, 30_000),
    completed_at: fixtureTimestamp(1),
    probe_total: 4,
    probe_failures: 0,
    failure_stage: null,
    failure_reason: null,
    alert_request_status: "not_needed",
    alert_channel: null,
    alert_run_url: null,
    alert_run_status: null,
    alert_run_conclusion: null,
    alert_run_checked_at: null,
    alert_run_error: null,
    archive_sample: null,
    stage_durations_ms: {
      prepare: 1_000,
      build: 10_000,
      migration_preflight: 2_000,
      candidate_health: 7_000,
      route_switch: 1_000,
      leader_handover: 5_000,
      public_probe: 3_000,
      state_write: 1_000,
    },
  },
];

const ARCHIVE_FIXTURE_ENTRIES = [
  {
    status: "rolled_back",
    from_slot: "blue",
    to_slot: "green",
    active_slot: "blue",
    version: "v1.38.70",
    revision: "a".repeat(40),
    started_at: fixtureTimestamp(2, 60_000),
    completed_at: fixtureTimestamp(2),
    probe_total: 3,
    probe_failures: 1,
    failure_stage: "public_probe",
    failure_reason: "=archive fixture probe failure",
    alert_request_status: "not_needed",
    alert_channel: null,
    alert_run_url: null,
    alert_run_status: null,
    alert_run_conclusion: null,
    alert_run_checked_at: null,
    alert_run_error: null,
    archive_sample: "detailed",
    stage_durations_ms: {
      prepare: 2_000,
      build: 12_000,
      migration_preflight: 3_000,
      candidate_health: 10_000,
      route_switch: 5_000,
      leader_handover: 8_000,
      public_probe: 18_000,
      state_write: 2_000,
    },
  },
  {
    status: "failed_before_switch",
    from_slot: "green",
    to_slot: "blue",
    active_slot: "green",
    version: "v1.38.69",
    revision: "b".repeat(40),
    started_at: fixtureTimestamp(10, 120_000),
    completed_at: fixtureTimestamp(10),
    probe_total: 0,
    probe_failures: 0,
    failure_stage: "build",
    failure_reason: "+archive fixture build failure",
    alert_request_status: "not_needed",
    alert_channel: null,
    alert_run_url: null,
    alert_run_status: null,
    alert_run_conclusion: null,
    alert_run_checked_at: null,
    alert_run_error: null,
    archive_sample: "daily",
    stage_durations_ms: {
      prepare: 10_000,
      build: 110_000,
    },
  },
];

export async function checkManagerDeploymentArchiveFixture({ cdp, timeoutMs }) {
  const response = await readManagerDeploymentFixtureSource(cdp);
  assert.equal(response.ok, true, "Manager 배포 보관 이력 fixture 원본을 읽지 못했습니다");
  const fixture = {
    ...response.body,
    deployment_history: CURRENT_FIXTURE_ENTRIES,
    deployment_history_archive: ARCHIVE_FIXTURE_ENTRIES,
    deployment_history_archive_summary: {
      detailed_count: 1,
      daily_count: 1,
      newest_at: ARCHIVE_FIXTURE_ENTRIES[0].completed_at,
      oldest_at: ARCHIVE_FIXTURE_ENTRIES[1].completed_at,
    },
    deployment_bottleneck_alert: buildManagerDeploymentBottleneckAlertFixture(),
  };

  await reloadWithDeploymentFixture({ cdp, fixture, timeoutMs });
  await waitForCondition(
    cdp,
    `document.querySelector('[data-history-source="current"] [data-history-source-filter="archive"]')?.textContent?.includes('보관 이력 2') &&
      document.querySelector('[data-history-source="current"] [data-history-source-filter="all"]')?.textContent?.includes('통합 3') &&
      document.querySelector('[data-deployment-history-retention]')?.textContent?.includes('UTC 날짜별 마지막 배포 1건') &&
      document.querySelector('[data-deployment-history-retention]')?.getAttribute('data-detailed-archive-count') === '1' &&
      document.querySelector('[data-deployment-history-retention]')?.getAttribute('data-daily-archive-count') === '1' &&
      document.querySelector('[data-deployment-archive-range]')?.textContent?.includes('~')`,
    timeoutMs,
    "Manager 현재·통합·보관 이력 source 버튼이 표시되지 않았습니다",
  );
  await waitForCondition(
    cdp,
    `document.querySelector('[data-manager-deployment-bottleneck-status="alerted"]')?.textContent?.includes('연속 3/3회') &&
      document.querySelector('[data-manager-deployment-bottleneck-status="alerted"]')?.textContent?.includes('이벤트 30일 보관') &&
      document.querySelector('[data-manager-deployment-bottleneck-source]')?.textContent?.includes('환경 변수 우선 (이벤트 보관 기간)') &&
      document.querySelector('[data-manager-deployment-bottleneck-storage]')?.textContent?.includes('이력 보관 84/100건') &&
      Boolean(document.querySelector('[data-manager-deployment-bottleneck-storage-warning]')) &&
      document.querySelector('[data-testid="manager-deployment-bottleneck-storage-audit-link"]')?.getAttribute('href') ===
        '/dashboard/audit?filter=manager_health&manager_source=api&period=90&q=deployment-bottleneck-storage&expand=latest' &&
      document.querySelector('[data-manager-deployment-bottleneck-storage-run]')?.textContent?.includes('보관 경고 전송 경로: Anubis Telegram') &&
      document.querySelector('[data-manager-deployment-bottleneck-status="alerted"]')?.textContent?.includes('알림 전송 경로: Anubis Telegram') &&
      Boolean(document.querySelector('[data-manager-deployment-bottleneck-override]')) &&
      Boolean(document.querySelector('[data-manager-deployment-bottleneck-event="alerted"]'))`,
    timeoutMs,
    "Manager 배포 병목 운영 알림 상태가 표시되지 않았습니다",
  );
  await checkManagerDeploymentBottleneckEvents({
    cdp,
    reload: () => reloadWithDeploymentFixture({ cdp, fixture, timeoutMs }),
    timeoutMs,
  });

  await evaluate(cdp, `document.querySelector('[data-history-source-filter="archive"]')?.click()`);
  await waitForCondition(
    cdp,
    `document.querySelectorAll('[data-history-source="archive"] li[data-deployment-status]').length === 2`,
    timeoutMs,
    "Manager 보관 이력 fixture로 전환되지 않았습니다",
  );
  const transitionSummary = await evaluate(cdp, `(() => {
    const entries = Array.from(document.querySelectorAll(
      '[data-history-source="archive"] li[data-deployment-status]',
    ));
    return {
      durations: entries.map((entry) =>
        entry.querySelector('[data-deployment-duration]')?.getAttribute('data-deployment-duration'),
      ),
      slots: entries.map((entry) =>
        entry.querySelector('[data-deployment-slot-summary]')?.textContent?.trim(),
      ),
      samples: entries.map((entry) =>
        entry.querySelector('[data-deployment-archive-sample]')?.getAttribute('data-deployment-archive-sample'),
      ),
    };
  })()`);
  assert.deepEqual(transitionSummary.durations, ["1분", "2분"]);
  assert.deepEqual(transitionSummary.samples, ["detailed", "daily"]);
  assert.match(transitionSummary.slots[0], /blue → green · 최종 활성 blue/);
  assert.match(transitionSummary.slots[1], /green → blue · 최종 활성 green/);
  await checkManagerDeploymentArchiveSamples({ cdp, timeoutMs });
  await checkManagerDeploymentHistoryActions({ cdp, timeoutMs });
  await checkHistorySearchAndFilters({ cdp, timeoutMs });
  await reloadWithDeploymentFixture({ cdp, fixture, timeoutMs });
  await waitForHistoryQueryRestore({ cdp, timeoutMs });
  await checkManagerDeploymentHistoryExports({ cdp, timeoutMs });
  const sourceConditionRemoved = await evaluate(cdp, `(() => {
    const button = document.querySelector('[data-history-condition="source"]');
    button?.click();
    return Boolean(button);
  })()`);
  assert.equal(sourceConditionRemoved, true, "Manager 보관 이력 적용 조건을 찾지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const params = new URLSearchParams(location.search);
      return Boolean(document.querySelector('[data-history-source="current"]')) &&
        !params.has('deployment_source');
    })()`,
    timeoutMs,
    "Manager 현재 배포 이력으로 복귀하지 못했습니다",
  );
  await evaluate(cdp, `document.querySelector('button[aria-label="알림 닫기"]')?.click()`);
}

async function reloadWithDeploymentFixture({ cdp, fixture, timeoutMs }) {
  await cdp.send("Fetch.enable", {
    patterns: [{ requestStage: "Request", urlPattern: "*/api/v1/docker/deployment*" }],
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
  } finally {
    await cdp.send("Fetch.disable");
  }
}
