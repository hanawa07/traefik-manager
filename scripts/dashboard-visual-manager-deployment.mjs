import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";
import { checkManagerDeploymentHistoryActions } from "./dashboard-visual-manager-deployment-actions.mjs";
import {
  checkManagerDeploymentArchiveSamples,
  readManagerDeploymentFixtureSource,
  setManagerDeploymentArchiveSample,
} from "./dashboard-visual-manager-deployment-archive.mjs";
import { checkManagerDeploymentHistoryExports } from "./dashboard-visual-manager-deployment-export.mjs";
import {
  buildManagerDeploymentBottleneckAlertFixture,
  checkManagerDeploymentBottleneckEvents,
} from "./dashboard-visual-manager-deployment-bottleneck.mjs";

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

export async function checkManagerDeploymentHistory({ cdp, timeoutMs }) {
  const snapshot = await evaluate(cdp, `(() => {
    const section = document.querySelector('[data-manager-deployment-history]');
    const entries = Array.from(section?.querySelectorAll('li[data-deployment-status]') || []);
    return {
      exists: Boolean(section),
      filters: section?.querySelectorAll('button[data-history-filter]').length || 0,
      statuses: entries.map((entry) => entry.getAttribute('data-deployment-status')),
      failureDetails: section?.querySelectorAll('[data-deployment-failure-detail]').length || 0,
      failureStats: Boolean(section?.querySelector('[data-deployment-failure-stats]')),
      exports: section?.querySelectorAll('button[data-history-export]').length || 0,
      durations: entries.map((entry) =>
        entry.querySelector('[data-deployment-duration]')?.getAttribute('data-deployment-duration'),
      ),
      slotSummaries: entries.map((entry) =>
        entry.querySelector('[data-deployment-slot-summary]')?.textContent?.trim(),
      ),
      linksValid: entries.every((entry) => {
        const links = Array.from(entry.querySelectorAll('a')).map((link) => link.href);
        const release = links.find((href) => href.includes('/releases/tag/'))?.split('/releases/tag/')[1];
        const revision = links.find((href) => href.includes('/commit/'))?.split('/commit/')[1];
        return release?.startsWith('v') && release.split('.').length === 3 &&
          revision?.length === 40 &&
          Array.from(revision).every((character) => '0123456789abcdef'.includes(character));
      }),
    };
  })()`);

  assert.equal(snapshot.exists, true, "Manager 배포 이력 카드를 찾지 못했습니다");
  if (snapshot.statuses.length > 0) {
    assert.equal(snapshot.filters, 7, "Manager 배포 이력 상태 필터 수가 다릅니다");
    assert.equal(snapshot.exports, 2, "Manager 배포 이력 내보내기 버튼 수가 다릅니다");
    assert.equal(snapshot.linksValid, true, "Manager 배포 이력의 커밋·릴리즈 링크가 올바르지 않습니다");
    assert.equal(
      snapshot.durations.every((duration) => duration),
      true,
      "Manager 배포 이력 소요시간이 보이지 않습니다",
    );
    assert.equal(
      snapshot.slotSummaries.every((summary) =>
        summary?.includes('전환') && summary.includes('최종 활성'),
      ),
      true,
      "Manager 배포 이력 슬롯 전환 요약이 보이지 않습니다",
    );
    if (snapshot.statuses.some((status) => status !== "success")) {
      assert.ok(snapshot.failureDetails > 0, "Manager 실패 배포 이력의 단계·원인이 보이지 않습니다");
      assert.equal(snapshot.failureStats, true, "Manager 배포 실패 단계 통계가 보이지 않습니다");
    }

    await checkStatusFilter({ cdp, snapshot, timeoutMs });
  }

  await checkArchiveFixture({ cdp, timeoutMs });
  return true;
}

async function checkStatusFilter({ cdp, snapshot, timeoutMs }) {
  const selectedStatus = snapshot.statuses[0];
  const clicked = await evaluate(cdp, `(() => {
    const button = document.querySelector(
      ${JSON.stringify(`button[data-history-filter="${selectedStatus}"]`)},
    );
    button?.click();
    return Boolean(button);
  })()`);
  assert.equal(clicked, true, "Manager 배포 이력 상태 필터 버튼을 찾지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const entries = Array.from(document.querySelectorAll(
        '[data-manager-deployment-history] li[data-deployment-status]',
      ));
      return entries.length > 0 && entries.every(
        (entry) => entry.getAttribute('data-deployment-status') === ${JSON.stringify(selectedStatus)},
      );
    })()`,
    timeoutMs,
    "Manager 배포 이력 상태 필터가 적용되지 않았습니다",
  );

  await evaluate(cdp, `document.querySelector('button[data-history-filter="all"]')?.click()`);
  await waitForCondition(
    cdp,
    `document.querySelectorAll('[data-manager-deployment-history] li[data-deployment-status]').length === ${snapshot.statuses.length}`,
    timeoutMs,
    "Manager 배포 이력 전체 필터가 복원되지 않았습니다",
  );
}

async function checkArchiveFixture({ cdp, timeoutMs }) {
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
      document.querySelector('[data-manager-deployment-bottleneck-storage]')?.textContent?.includes('이력 보관 24/100건') &&
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

async function checkHistorySearchAndFilters({ cdp, timeoutMs }) {
  await setHistorySearch({ cdp, expectedText: "v1.38.69", timeoutMs, value: "v1.38.69" });
  await setHistorySearch({ cdp, expectedText: "v1.38.69", timeoutMs, value: "bbbbbbbbbbbb" });
  await setManagerDeploymentArchiveSample({ cdp, expectedCount: 0, timeoutMs, value: "detailed" });
  await setHistorySearch({ cdp, expectedText: "v1.38.70", timeoutMs, value: "probe failure" });
  const statusClicked = await evaluate(cdp, `(() => {
    const status = document.querySelector('[data-history-filter="rolled_back"]');
    status?.click();
    return Boolean(status);
  })()`);
  assert.equal(statusClicked, true, "Manager 배포 상태 필터 버튼을 찾지 못했습니다");
  await waitForCondition(
    cdp,
    `new URLSearchParams(location.search).get('deployment_status') === 'rolled_back'`,
    timeoutMs,
    "Manager 배포 상태 URL 조건이 적용되지 않았습니다",
  );
  const stageClicked = await evaluate(cdp, `(() => {
    const stage = document.querySelector('[data-failure-stage-filter="public_probe"]');
    stage?.click();
    return Boolean(stage);
  })()`);
  assert.equal(stageClicked, true, "Manager 배포 실패 단계 필터 버튼을 찾지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const params = new URLSearchParams(location.search);
      const entries = Array.from(document.querySelectorAll(
        '[data-history-source="archive"] li[data-deployment-status]',
      ));
      return entries.length === 1 && entries.every(
        (entry) => entry.getAttribute('data-deployment-status') === 'rolled_back' &&
          entry.getAttribute('data-deployment-failure-stage') === 'public_probe',
      ) && params.get('deployment_source') === 'archive' &&
        params.get('deployment_period') === '30' &&
        params.get('deployment_status') === 'rolled_back' &&
        params.get('deployment_stage') === 'public_probe' &&
        params.get('deployment_q') === 'probe failure';
    })()`,
    timeoutMs,
    "Manager 배포 검색·상태·실패 단계 URL 조건이 적용되지 않았습니다",
  );
  await checkActiveConditionRemoval({ cdp, timeoutMs });
}

async function checkActiveConditionRemoval({ cdp, timeoutMs }) {
  const conditions = await evaluate(cdp, `Array.from(document.querySelectorAll(
    '[data-history-active-conditions] [data-history-condition]',
  )).map((condition) => condition.getAttribute('data-history-condition'))`);
  assert.deepEqual(
    conditions,
    ["source", "archive_sample", "period", "status", "stage", "search"],
    "Manager 배포 이력 적용 조건 칩 구성이 다릅니다",
  );

  const searchRemoved = await evaluate(cdp, `(() => {
    const button = document.querySelector('[data-history-condition="search"]');
    button?.click();
    return Boolean(button);
  })()`);
  assert.equal(searchRemoved, true, "Manager 배포 검색 조건 제거 버튼을 찾지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const params = new URLSearchParams(location.search);
      const conditions = Array.from(document.querySelectorAll('[data-history-condition]'))
        .map((condition) => condition.getAttribute('data-history-condition'));
      return !params.has('deployment_q') &&
        params.get('deployment_source') === 'archive' &&
        params.get('deployment_period') === '30' &&
        params.get('deployment_status') === 'rolled_back' &&
        params.get('deployment_stage') === 'public_probe' &&
        conditions.join(',') === 'source,archive_sample,period,status,stage';
    })()`,
    timeoutMs,
    "Manager 배포 검색 조건만 개별 제거되지 않았습니다",
  );
  await setHistorySearch({
    cdp,
    expectedText: "v1.38.70",
    timeoutMs,
    value: "probe failure",
  });
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

async function setHistorySearch({ cdp, expectedText, timeoutMs, value }) {
  const changed = await evaluate(cdp, `(() => {
    const input = document.querySelector('[data-history-search]');
    if (!(input instanceof HTMLInputElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, "Manager 배포 이력 검색어를 입력하지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const section = document.querySelector('[data-history-source="archive"]');
      return section?.querySelectorAll('li[data-deployment-status]').length === 1 &&
        section.textContent?.includes(${JSON.stringify(expectedText)}) &&
        document.querySelector('[data-history-search]')?.value === ${JSON.stringify(value)} &&
        Array.from(section.querySelectorAll('[data-history-search-highlight]')).some(
          (highlight) => highlight.textContent?.toLowerCase() === ${JSON.stringify(value.toLowerCase())},
        );
    })()`,
    timeoutMs,
    `Manager 배포 이력 ${value} 검색이 적용되지 않았습니다`,
  );
}

async function waitForHistoryQueryRestore({ cdp, timeoutMs }) {
  await waitForCondition(
    cdp,
    `(() => {
      const params = new URLSearchParams(location.search);
      const entry = document.querySelector(
        '[data-history-source="archive"] li[data-deployment-status]',
      );
      return document.querySelector('[data-history-search]')?.value === 'probe failure' &&
        document.querySelector('[data-history-archive-sample]')?.value === 'detailed' &&
        document.querySelector('[data-history-period]')?.value === '30' &&
        document.querySelector('[data-history-filter="rolled_back"]')?.getAttribute('aria-pressed') === 'true' &&
        document.querySelector('[data-failure-stage-filter="public_probe"]')?.getAttribute('aria-pressed') === 'true' &&
        entry?.getAttribute('data-deployment-status') === 'rolled_back' &&
        entry.getAttribute('data-deployment-failure-stage') === 'public_probe' &&
        document.querySelectorAll('[data-history-condition]').length === 6 &&
        document.querySelector('[data-history-search-highlight]')?.textContent === 'probe failure' &&
        params.get('deployment_source') === 'archive' &&
        params.get('deployment_archive_sample') === 'detailed' &&
        params.get('deployment_period') === '30' &&
        !params.has('deployment_from') && !params.has('deployment_to') &&
        params.get('deployment_q') === 'probe failure';
    })()`,
    timeoutMs,
    "Manager 배포 이력 URL 조건이 새로고침 후 복원되지 않았습니다",
  );
}
