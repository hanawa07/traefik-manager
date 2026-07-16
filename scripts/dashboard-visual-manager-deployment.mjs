import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

const ARCHIVE_FIXTURE_ENTRIES = [
  {
    status: "rolled_back",
    from_slot: "blue",
    to_slot: "green",
    active_slot: "blue",
    version: "v1.38.70",
    revision: "a".repeat(40),
    started_at: "2026-07-01T00:00:00Z",
    completed_at: "2026-07-01T00:01:00Z",
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
  },
  {
    status: "failed_before_switch",
    from_slot: "green",
    to_slot: "blue",
    active_slot: "green",
    version: "v1.38.69",
    revision: "b".repeat(40),
    started_at: "2026-06-30T00:00:00Z",
    completed_at: "2026-06-30T00:01:00Z",
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
    assert.equal(snapshot.filters, 5, "Manager 배포 이력 상태 필터 수가 다릅니다");
    assert.equal(snapshot.exports, 2, "Manager 배포 이력 내보내기 버튼 수가 다릅니다");
    assert.equal(snapshot.linksValid, true, "Manager 배포 이력의 커밋·릴리즈 링크가 올바르지 않습니다");
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
  const response = await evaluate(cdp, `(async () => {
    const result = await fetch('/api/v1/docker/deployment', {
      credentials: 'include',
      cache: 'no-store',
    });
    return { body: await result.json(), ok: result.ok };
  })()`);
  assert.equal(response.ok, true, "Manager 배포 보관 이력 fixture 원본을 읽지 못했습니다");
  const fixture = {
    ...response.body,
    deployment_history_archive: ARCHIVE_FIXTURE_ENTRIES,
  };

  await reloadWithDeploymentFixture({ cdp, fixture, timeoutMs });
  await waitForCondition(
    cdp,
    `document.querySelector('[data-history-source="current"] [data-history-source-toggle]')?.textContent?.includes('회전 보관 2건 보기')`,
    timeoutMs,
    "Manager .1 보관 이력 fixture 전환 버튼이 표시되지 않았습니다",
  );

  await evaluate(cdp, `document.querySelector('[data-history-source-toggle]')?.click()`);
  await waitForCondition(
    cdp,
    `document.querySelectorAll('[data-history-source="archive"] li[data-deployment-status]').length === 2`,
    timeoutMs,
    "Manager .1 보관 이력 fixture로 전환되지 않았습니다",
  );
  await checkHistorySearchAndFilters({ cdp, timeoutMs });
  await reloadWithDeploymentFixture({ cdp, fixture, timeoutMs });
  await waitForHistoryQueryRestore({ cdp, timeoutMs });
  await checkHistoryExports({ cdp, timeoutMs });
  await evaluate(cdp, `document.querySelector('[data-history-source-toggle]')?.click()`);
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
        params.get('deployment_status') === 'rolled_back' &&
        params.get('deployment_stage') === 'public_probe' &&
        params.get('deployment_q') === 'probe failure';
    })()`,
    timeoutMs,
    "Manager 배포 검색·상태·실패 단계 URL 조건이 적용되지 않았습니다",
  );
}

async function checkHistoryExports({ cdp, timeoutMs }) {
  const json = await captureHistoryDownload(cdp, "json");
  assert.match(json.filename, /deployments-archive-\d{4}-\d{2}-\d{2}\.json$/);
  const jsonEntries = JSON.parse(json.text);
  assert.equal(jsonEntries.length, 1, "Manager JSON 내보내기에 현재 필터가 반영되지 않았습니다");
  assert.equal(jsonEntries[0].failure_stage, "public_probe");
  await waitForExportToast({ cdp, filename: json.filename, format: "JSON", timeoutMs });

  await evaluate(cdp, `document.querySelector('[data-history-filter-reset]')?.click()`);
  await waitForCondition(
    cdp,
    `(() => {
      const params = new URLSearchParams(location.search);
      return document.querySelectorAll(
        '[data-history-source="archive"] li[data-deployment-status]',
      ).length === 2 && !params.has('deployment_q') &&
        !params.has('deployment_status') && !params.has('deployment_stage') &&
        params.get('deployment_source') === 'archive';
    })()`,
    timeoutMs,
    "Manager 배포 이력 조건 초기화가 적용되지 않았습니다",
  );
  const csv = await captureHistoryDownload(cdp, "csv");
  assert.match(csv.filename, /deployments-archive-\d{4}-\d{2}-\d{2}\.csv$/);
  assert.deepEqual(csv.bytes, [239, 187, 191], "Manager CSV UTF-8 BOM이 없습니다");
  assert.match(csv.text, /^status,from_slot,to_slot,/);
  assert.match(csv.text, /"'=archive fixture probe failure"/);
  assert.match(csv.text, /"'\+archive fixture build failure"/);
  await waitForExportToast({ cdp, filename: csv.filename, format: "CSV", timeoutMs });
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
        document.querySelector('[data-history-search]')?.value === ${JSON.stringify(value)};
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
        document.querySelector('[data-history-filter="rolled_back"]')?.getAttribute('aria-pressed') === 'true' &&
        document.querySelector('[data-failure-stage-filter="public_probe"]')?.getAttribute('aria-pressed') === 'true' &&
        entry?.getAttribute('data-deployment-status') === 'rolled_back' &&
        entry.getAttribute('data-deployment-failure-stage') === 'public_probe' &&
        params.get('deployment_source') === 'archive' &&
        params.get('deployment_q') === 'probe failure';
    })()`,
    timeoutMs,
    "Manager 배포 이력 URL 조건이 새로고침 후 복원되지 않았습니다",
  );
}

async function waitForExportToast({ cdp, filename, format, timeoutMs }) {
  await waitForCondition(
    cdp,
    `document.body.textContent?.includes(${JSON.stringify(`${format} 내보내기 완료`)}) &&
      document.body.textContent?.includes(${JSON.stringify(filename)})`,
    timeoutMs,
    `Manager ${format} 내보내기 완료 파일명이 표시되지 않았습니다`,
  );
}

async function captureHistoryDownload(cdp, format) {
  const result = await evaluate(cdp, `(async () => {
    const button = document.querySelector(
      ${JSON.stringify(`[data-history-export="${format}"]`)},
    );
    if (!button) return null;
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    const originalClick = HTMLAnchorElement.prototype.click;
    let blob = null;
    let filename = '';
    try {
      URL.createObjectURL = (value) => { blob = value; return 'blob:deployment-history-smoke'; };
      URL.revokeObjectURL = () => {};
      HTMLAnchorElement.prototype.click = function () { filename = this.download; };
      button.click();
      if (!blob) return null;
      const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()).slice(0, 3));
      return { bytes, filename, text: await blob.text(), type: blob.type };
    } finally {
      URL.createObjectURL = originalCreateObjectUrl;
      URL.revokeObjectURL = originalRevokeObjectUrl;
      HTMLAnchorElement.prototype.click = originalClick;
    }
  })()`);
  assert.ok(result, `Manager ${format.toUpperCase()} 내보내기를 캡처하지 못했습니다`);
  return result;
}
