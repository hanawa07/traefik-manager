import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

export async function checkManagerDeploymentHistoryActions({ cdp, timeoutMs }) {
  await checkCombinedSource({ cdp, timeoutMs });
  await selectPeriod({ cdp, expectedCount: 1, timeoutMs, value: "7" });
  await selectPeriod({ cdp, expectedCount: 2, timeoutMs, value: "30" });
  await checkCustomDateRange({ cdp, timeoutMs });
  await selectPeriod({ cdp, expectedCount: 2, timeoutMs, value: "30" });
  await checkFailureStageAverages(cdp);
  await checkJsonDetails({ cdp, timeoutMs });
  await checkCompareLink(cdp);
  await checkCopyButtons({ cdp, timeoutMs });
}

async function checkCombinedSource({ cdp, timeoutMs }) {
  await selectSource({ cdp, expectedCount: 3, source: "all", timeoutMs });
  const sourceBadges = await evaluate(cdp, `Array.from(document.querySelectorAll(
    '[data-history-source="all"] [data-deployment-source]',
  )).map((badge) => badge.getAttribute('data-deployment-source'))`);
  assert.deepEqual(sourceBadges, ["current", "archive", "archive"]);
  await checkSourceSummaryAndRateHelp({ cdp, timeoutMs });
  await waitForCondition(
    cdp,
    `document.querySelector('[data-deployment-success-rate]')?.getAttribute(
      'data-deployment-success-rate',
    ) === '33' && document.querySelector('[data-deployment-rollback-rate]')?.getAttribute(
      'data-deployment-rollback-rate',
    ) === '33'`,
    timeoutMs,
    "Manager 통합 배포 성공률·롤백률이 올바르지 않습니다",
  );
  await clickRateFilter({ cdp, expectedCount: 1, status: "success", timeoutMs });
  await clickRateFilter({ cdp, expectedCount: 1, status: "rollback", timeoutMs });
  await clickRateFilter({ cdp, expectedCount: 3, status: "all", timeoutMs });
  await setCombinedSearch({ cdp, timeoutMs, value: "v1.38" });
  await setCombinedSearch({ cdp, timeoutMs, value: "" });
  await selectSource({ cdp, expectedCount: 2, source: "archive", timeoutMs });
  const archiveRates = await evaluate(cdp, `(() => ({
    rollback: document.querySelector('[data-deployment-rollback-rate]')?.getAttribute(
      'data-deployment-rollback-rate',
    ),
    success: document.querySelector('[data-deployment-success-rate]')?.getAttribute(
      'data-deployment-success-rate',
    ),
  }))()`);
  assert.deepEqual(archiveRates, { rollback: "50", success: "0" });
}

async function checkSourceSummaryAndRateHelp({ cdp, timeoutMs }) {
  const sourceCounts = await evaluate(cdp, `(() => {
    const summary = document.querySelector('[data-deployment-source-counts]');
    return {
      archive: summary?.getAttribute('data-deployment-archive-count'),
      current: summary?.getAttribute('data-deployment-current-count'),
    };
  })()`);
  assert.deepEqual(sourceCounts, { archive: "2", current: "1" });
  const opened = await evaluate(cdp, `(() => {
    const details = document.querySelector('[data-deployment-rate-help]');
    details?.querySelector('summary')?.click();
    return Boolean(details);
  })()`);
  assert.equal(opened, true, "Manager 배포 비율 산정 기준을 찾지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const details = document.querySelector('[data-deployment-rate-help]');
      return details?.hasAttribute('open') &&
        details.textContent?.includes('success') &&
        details.textContent?.includes('rolled_back·rollback_failed') &&
        details.textContent?.includes('검색 필터는 비율에 반영하지 않습니다');
    })()`,
    timeoutMs,
    "Manager 배포 비율 산정 기준을 펼치지 못했습니다",
  );
}

async function clickRateFilter({ cdp, expectedCount, status, timeoutMs }) {
  const kind = status === "success" ? "success" : "rollback";
  const clicked = await evaluate(cdp, `(() => {
    const button = document.querySelector(${JSON.stringify(
      `[data-deployment-rate-filter="${kind}"]`,
    )});
    button?.click();
    return Boolean(button);
  })()`);
  assert.equal(clicked, true, `Manager ${kind} 비율 필터를 찾지 못했습니다`);
  await waitForCondition(
    cdp,
    `(() => {
      const params = new URLSearchParams(location.search);
      return document.querySelectorAll(
        '[data-history-source="all"] li[data-deployment-status]',
      ).length === ${expectedCount} && ${status === "all"
        ? "!params.has('deployment_status')"
        : `params.get('deployment_status') === ${JSON.stringify(status)}`};
    })()`,
    timeoutMs,
    `Manager ${status} 비율 필터가 적용되지 않았습니다`,
  );
}

async function selectSource({ cdp, expectedCount, source, timeoutMs }) {
  const clicked = await evaluate(cdp, `(() => {
    const button = document.querySelector(${JSON.stringify(
      `[data-history-source-filter="${source}"]`,
    )});
    button?.click();
    return Boolean(button);
  })()`);
  assert.equal(clicked, true, `Manager ${source} 이력 source 버튼을 찾지 못했습니다`);
  await waitForCondition(
    cdp,
    `(() => {
      const params = new URLSearchParams(location.search);
      return document.querySelector('[data-history-source="${source}"]') &&
        document.querySelectorAll(
          '[data-history-source="${source}"] li[data-deployment-status]',
        ).length === ${expectedCount} &&
        params.get('deployment_source') === ${JSON.stringify(source)};
    })()`,
    timeoutMs,
    `Manager ${source} 통합 source가 적용되지 않았습니다`,
  );
}

async function setCombinedSearch({ cdp, timeoutMs, value }) {
  const changed = await evaluate(cdp, `(() => {
    const input = document.querySelector('[data-history-search]');
    if (!(input instanceof HTMLInputElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, "Manager 통합 이력 검색어를 입력하지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const params = new URLSearchParams(location.search);
      return document.querySelectorAll(
        '[data-history-source="all"] li[data-deployment-status]',
      ).length === 3 && ${value ? `params.get('deployment_q') === ${JSON.stringify(value)}` : "!params.has('deployment_q')"};
    })()`,
    timeoutMs,
    "Manager 현재·보관 통합 검색이 적용되지 않았습니다",
  );
}

async function selectPeriod({ cdp, expectedCount, timeoutMs, value }) {
  const changed = await evaluate(cdp, `(() => {
    const select = document.querySelector('[data-history-period]');
    if (!(select instanceof HTMLSelectElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    setter?.call(select, ${JSON.stringify(value)});
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, "Manager 배포 이력 기간을 선택하지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const params = new URLSearchParams(location.search);
      return document.querySelector('[data-history-period]')?.value === ${JSON.stringify(value)} &&
        document.querySelectorAll(
          '[data-history-source="archive"] li[data-deployment-status]',
        ).length === ${expectedCount} &&
        document.querySelector('[data-history-condition="period"]') &&
        params.get('deployment_period') === ${JSON.stringify(value)} &&
        !params.has('deployment_from') && !params.has('deployment_to');
    })()`,
    timeoutMs,
    `Manager 최근 ${value}일 배포 기간 필터가 적용되지 않았습니다`,
  );
}

async function checkCustomDateRange({ cdp, timeoutMs }) {
  const dateFrom = formatDateInput(5);
  const dateTo = formatDateInput(0);
  await setDateInput({ cdp, kind: "from", timeoutMs, value: dateFrom });
  await setDateInput({ cdp, kind: "to", timeoutMs, value: dateTo });
  await waitForCondition(
    cdp,
    `(() => {
      const params = new URLSearchParams(location.search);
      const conditions = Array.from(document.querySelectorAll('[data-history-condition]'))
        .map((condition) => condition.getAttribute('data-history-condition'));
      return document.querySelector('[data-history-period]')?.value === 'all' &&
        document.querySelectorAll(
          '[data-history-source="archive"] li[data-deployment-status]',
        ).length === 1 &&
        params.get('deployment_from') === ${JSON.stringify(dateFrom)} &&
        params.get('deployment_to') === ${JSON.stringify(dateTo)} &&
        !params.has('deployment_period') &&
        conditions.join(',') === 'source,date_from,date_to';
    })()`,
    timeoutMs,
    "Manager 사용자 지정 배포 기간이 적용되지 않았습니다",
  );
}

async function setDateInput({ cdp, kind, timeoutMs, value }) {
  const changed = await evaluate(cdp, `(() => {
    const input = document.querySelector(${JSON.stringify(`[data-history-date-${kind}]`)});
    if (!(input instanceof HTMLInputElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, `Manager 사용자 지정 ${kind} 날짜를 입력하지 못했습니다`);
  const queryKey = kind === "from" ? "deployment_from" : "deployment_to";
  await waitForCondition(
    cdp,
    `new URLSearchParams(location.search).get(${JSON.stringify(queryKey)}) === ${JSON.stringify(value)}`,
    timeoutMs,
    `Manager 사용자 지정 ${kind} 날짜가 URL에 반영되지 않았습니다`,
  );
}

function formatDateInput(daysAgo) {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1_000).toISOString().slice(0, 10);
}

async function checkFailureStageAverages(cdp) {
  const averages = await evaluate(cdp, `Object.fromEntries(Array.from(document.querySelectorAll(
    '[data-failure-stage-average]',
  )).map((item) => [item.getAttribute('data-failure-stage-average'), item.textContent?.trim()]))`);
  assert.match(averages.build, /이미지 빌드 1 · 평균 1분/);
  assert.match(averages.public_probe, /공개 health probe 1 · 평균 1분/);
}

async function checkJsonDetails({ cdp, timeoutMs }) {
  const clicked = await evaluate(cdp, `(() => {
    const details = document.querySelector('[data-deployment-json-details]');
    const toggle = details?.querySelector('[data-deployment-json-toggle]');
    toggle?.click();
    return Boolean(details && toggle);
  })()`);
  assert.equal(clicked, true, "Manager 배포 상세 JSON 토글을 찾지 못했습니다");
  await waitForCondition(
    cdp,
    `document.querySelector('[data-deployment-json-details]')?.hasAttribute('open')`,
    timeoutMs,
    "Manager 배포 상세 JSON을 펼치지 못했습니다",
  );
  const entry = await evaluate(cdp, `(() => {
    const text = document.querySelector('[data-deployment-json]')?.textContent;
    return text ? JSON.parse(text) : null;
  })()`);
  assert.equal(entry.version, "v1.38.70");
  assert.equal(entry.revision, "a".repeat(40));
  assert.equal(entry.failure_stage, "public_probe");
}

async function checkCompareLink(cdp) {
  const links = await evaluate(cdp, `Array.from(document.querySelectorAll(
    '[data-history-source="archive"] [data-deployment-compare]',
  )).map((link) => link.href)`);
  assert.equal(links.length, 1, "Manager 이전 버전 비교 링크 수가 다릅니다");
  assert.match(
    links[0],
    /\/compare\/v1\.38\.69\.\.\.v1\.38\.70$/,
    "Manager 이전·현재 버전 비교 URL이 올바르지 않습니다",
  );
}

async function checkCopyButtons({ cdp, timeoutMs }) {
  const buttons = await evaluate(cdp, `(() => ({
    failures: document.querySelectorAll('[data-deployment-copy="failure_reason"]').length,
    json: document.querySelectorAll('[data-deployment-copy="json"]').length,
    revisions: document.querySelectorAll('[data-deployment-copy="revision"]').length,
  }))()`);
  assert.deepEqual(buttons, { failures: 2, json: 2, revisions: 2 });

  await installClipboardCapture(cdp);
  await clickCopyAndWait({
    cdp,
    expected: "a".repeat(40),
    kind: "revision",
    toast: "커밋 SHA 복사 완료",
    timeoutMs,
  });
  await clickCopyAndWait({
    cdp,
    expected: "=archive fixture probe failure",
    kind: "failure_reason",
    toast: "실패 원인 복사 완료",
    timeoutMs,
  });
  const expectedJson = await evaluate(
    cdp,
    `(() => {
      const text = document.querySelector('[data-deployment-json]')?.textContent;
      return text ? JSON.stringify(JSON.parse(text), null, 2) : null;
    })()`,
  );
  assert.ok(expectedJson, "Manager 상세 JSON 원문을 읽지 못했습니다");
  await clickCopyAndWait({
    cdp,
    expected: expectedJson,
    kind: "json",
    toast: "상세 JSON 복사 완료",
    timeoutMs,
  });
}

async function installClipboardCapture(cdp) {
  const installed = await evaluate(cdp, `(() => {
    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (value) => { window.__managerDeploymentClipboard = value; },
        },
      });
      window.__managerDeploymentClipboard = '';
      return true;
    } catch {
      return false;
    }
  })()`);
  assert.equal(installed, true, "Manager 클립보드 캡처를 준비하지 못했습니다");
}

async function clickCopyAndWait({ cdp, expected, kind, toast, timeoutMs }) {
  const clicked = await evaluate(cdp, `(() => {
    const button = document.querySelector(
      ${JSON.stringify(`[data-deployment-copy="${kind}"]`)},
    );
    button?.click();
    return Boolean(button);
  })()`);
  assert.equal(clicked, true, `Manager ${kind} 복사 버튼을 찾지 못했습니다`);
  await waitForCondition(
    cdp,
    `window.__managerDeploymentClipboard === ${JSON.stringify(expected)} &&
      document.body.textContent?.includes(${JSON.stringify(toast)})`,
    timeoutMs,
    `Manager ${kind} 값과 복사 완료 알림이 일치하지 않습니다`,
  );
}
