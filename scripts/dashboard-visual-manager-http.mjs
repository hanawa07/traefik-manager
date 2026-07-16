import assert from "node:assert/strict";

import { captureVisualScreenshot } from "./dashboard-visual-artifacts.mjs";
import { checkManagerHttpLogStorageWarnings } from "./dashboard-visual-manager-log-storage.mjs";
import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

const MANAGER_HTTP_PREVIEW_CHECKED_AT = "2026-07-14T00:00:00Z";

function buildManagerHttpPreviewFixture(complete) {
  return {
    available: true,
    message: "Manager API 요청 로그 기준 권장값입니다.",
    window_hours: 24,
    window_minutes: 15,
    checked_at: MANAGER_HTTP_PREVIEW_CHECKED_AT,
    observed_since: complete ? "2026-07-13T00:00:00Z" : "2026-07-13T12:00:00Z",
    sample_coverage_percent: complete ? 100 : 50,
    peak_not_found_count: 26,
    peak_server_error_count: 6,
    recommended_not_found_threshold: 32,
    recommended_server_error_threshold: 8,
    excluded_paths: [
      {
        path: "/api/health",
        not_found_count: 1,
        server_error_count: 0,
        last_seen_at: "2026-07-13T23:00:00Z",
      },
    ],
  };
}

export async function checkManagerHttpErrorTrend({ cdp, timeoutMs = 15_000 }) {
  const snapshot = await evaluate(cdp, `(() => {
    const card = document.querySelector('[data-testid="manager-http-error-trend"]');
    const chart = document.querySelector('[data-testid="manager-http-error-chart-scroll"]');
    const logStorage = document.querySelector('[data-testid="manager-http-log-storage"]');
    const monitor = document.querySelector('[data-testid="manager-http-error-monitor-status"]');
    const route = document.querySelector('[data-testid="manager-route-status"]');
    return card ? {
      available: card.getAttribute('data-http-error-available'),
      bucketCount: card.querySelectorAll('[data-http-error-bucket="true"]').length,
      chartScrollWidth: chart?.scrollWidth ?? 0,
      chartWidth: chart?.clientWidth ?? 0,
      managerApiAlert: document.querySelector('[data-testid="manager-health-alert-banner"]')
        ?.getAttribute('data-manager-api-alert'),
      managerApiAuditHref: document.querySelector('[data-testid="manager-api-audit-link"]')
        ?.getAttribute('href'),
      sampleCoverage: Number(card.getAttribute('data-http-sample-coverage')),
      sampleReady: Boolean(document.querySelector('[data-testid="manager-http-sample-ready"]')),
      monitorStatus: monitor?.getAttribute('data-http-error-monitor-status'),
      route: route ? {
        healthy: route.getAttribute('data-route-healthy'),
        provider: route.getAttribute('data-route-provider'),
        upstreamStatus: route.getAttribute('data-route-upstream-status'),
      } : null,
      logStorage: logStorage ? {
        capacityBytes: Number(logStorage.getAttribute('data-log-capacity-bytes')),
        fileCount: Number(logStorage.getAttribute('data-log-file-count')),
        maxFileCount: Number(logStorage.getAttribute('data-log-max-file-count')),
        rotatedFileCount: Number(logStorage.getAttribute('data-log-rotated-file-count')),
        sizeBytes: Number(logStorage.getAttribute('data-log-size-bytes')),
        source: logStorage.getAttribute('data-log-source'),
        text: logStorage.textContent || '',
        warning: logStorage.getAttribute('data-log-warning'),
      } : null,
      text: card.textContent || '',
    } : null;
  })()`);

  assert.ok(snapshot, "Manager API 오류 추이 카드를 찾지 못했습니다");
  assert.deepEqual(
    snapshot.route,
    { healthy: "true", provider: "file", upstreamStatus: "UP" },
    "Manager file-provider 라우터가 정상 상태가 아닙니다",
  );
  assert.equal(snapshot.available, "true", "Manager API 오류 로그를 조회하지 못했습니다");
  assert.equal(snapshot.bucketCount, 24, "Manager API 오류 추이가 24개 시간 구간이 아닙니다");
  assert.ok(snapshot.chartScrollWidth >= snapshot.chartWidth, "Manager API 오류 차트 폭이 올바르지 않습니다");
  assert.match(snapshot.text, /관측 시작:/, "Manager API 오류 로그 관측 시각이 없습니다");
  assert.ok(snapshot.logStorage, "Manager API 요청 로그 보관 상태가 없습니다");
  assert.ok(
    ["persistent", "docker", "unavailable"].includes(snapshot.logStorage.source),
    "Manager API 요청 로그 보관 소스가 올바르지 않습니다",
  );
  assert.ok(
    Number.isInteger(snapshot.logStorage.sizeBytes) &&
      snapshot.logStorage.sizeBytes >= 0 &&
      snapshot.logStorage.sizeBytes <= snapshot.logStorage.capacityBytes,
    "Manager API 요청 로그 사용량이 올바르지 않습니다",
  );
  assert.ok(
    Number.isInteger(snapshot.logStorage.fileCount) &&
      snapshot.logStorage.fileCount >= 0 &&
      snapshot.logStorage.fileCount <= snapshot.logStorage.maxFileCount,
    "Manager API 요청 로그 파일 수가 올바르지 않습니다",
  );
  assert.ok(
    Number.isInteger(snapshot.logStorage.rotatedFileCount) &&
      snapshot.logStorage.rotatedFileCount >= 0 &&
      snapshot.logStorage.rotatedFileCount <= snapshot.logStorage.fileCount,
    "Manager API 요청 로그 회전 파일 수가 올바르지 않습니다",
  );
  assert.match(snapshot.logStorage.text, /사용량.*회전 파일/, "Manager API 요청 로그 상태 설명이 없습니다");
  assert.equal(
    snapshot.logStorage.warning,
    snapshot.logStorage.source === "docker"
      ? "docker"
      : snapshot.logStorage.source === "persistent" &&
          snapshot.logStorage.capacityBytes > 0 &&
          snapshot.logStorage.sizeBytes / snapshot.logStorage.capacityBytes >= 0.8
        ? "capacity"
        : "none",
    "Manager API 요청 로그 경고 상태가 현재 보관 상태와 다릅니다",
  );
  assert.ok(
    Number.isInteger(snapshot.sampleCoverage) &&
      snapshot.sampleCoverage >= 0 &&
      snapshot.sampleCoverage <= 100,
    "Manager API 오류 로그 표본 충족률이 올바르지 않습니다",
  );
  assert.equal(snapshot.sampleReady, snapshot.sampleCoverage === 100, "24시간 표본 안내 상태가 다릅니다");
  assert.ok(
    ["disabled", "pending", "unavailable", "breached", "healthy"].includes(snapshot.monitorStatus),
    "Manager API 오류 임계치 감지 상태가 올바르지 않습니다",
  );
  if (["breached", "unavailable"].includes(snapshot.managerApiAlert)) {
    assert.equal(
      snapshot.managerApiAuditHref,
      "/dashboard/audit?filter=manager_health&manager_source=api&period=1&expand=latest",
      "Manager API 상단 경고가 관련 감사 로그로 연결되지 않습니다",
    );
  }
  await checkManagerHttpErrorPreviewApi(cdp);
  await checkManagerHttpLogStorageWarnings({ cdp, timeoutMs });

  await setSelectValue(cdp, '[data-testid="manager-http-error-window"]', "6");
  await waitForCondition(
    cdp,
    `document.querySelector('[data-testid="manager-http-error-trend"]')?.getAttribute('data-http-error-window-hours') === '6' && document.querySelectorAll('[data-http-error-bucket="true"]').length === 6`,
    timeoutMs,
    "Manager API 오류 추이가 6시간 조건으로 갱신되지 않았습니다",
  );
  await setInputValue(cdp, '[data-testid="manager-http-error-path-filter"]', "services");
  await waitForCondition(
    cdp,
    `document.querySelector('[data-testid="manager-http-error-trend"]')?.getAttribute('data-http-error-path-filter') === 'services'`,
    timeoutMs,
    "Manager API 오류 경로 필터가 적용되지 않았습니다",
  );
  await setInputValue(cdp, '[data-testid="manager-http-error-path-filter"]', "");
  await setSelectValue(cdp, '[data-testid="manager-http-error-window"]', "24");
  await waitForCondition(
    cdp,
    `document.querySelector('[data-testid="manager-http-error-trend"]')?.getAttribute('data-http-error-window-hours') === '24' && document.querySelectorAll('[data-http-error-bucket="true"]').length === 24`,
    timeoutMs,
    "Manager API 오류 추이가 기본 24시간 조건으로 복원되지 않았습니다",
  );
}

export async function checkManagerHttpErrorPreviewForm({
  artifactDir,
  cdp,
  profile,
  timeoutMs = 15_000,
}) {
  const opened = await evaluate(cdp, `(() => {
    const card = document.querySelector('[data-testid="security-alert-settings-card"]');
    const edit = Array.from(card?.querySelectorAll('button') || []).find(
      (button) => button.textContent?.includes('편집')
    );
    edit?.click();
    return Boolean(edit);
  })()`);
  if (!opened) return false;

  await waitForCondition(
    cdp,
    `Boolean(document.querySelector('[data-testid="manager-http-error-preview-button"]'))`,
    timeoutMs,
    "Manager API 오류 권장값 계산 버튼이 표시되지 않았습니다",
  );
  const enabled = await evaluate(cdp, `(() => {
    const labels = Array.from(document.querySelectorAll('[data-testid="security-alert-settings-card"] label'));
    const checkbox = labels.find((label) => label.textContent?.includes('Manager API 오류 임계치 감지'))
      ?.querySelector('input[type="checkbox"]');
    if (checkbox && !checkbox.checked) checkbox.click();
    return Boolean(checkbox);
  })()`);
  assert.equal(enabled, true, "Manager API 오류 임계치 감지 체크박스를 찾지 못했습니다");
  await waitForCondition(
    cdp,
    `document.querySelector('[data-testid="manager-http-error-preview-button"]')?.disabled === false`,
    timeoutMs,
    "Manager API 오류 권장값 계산 버튼이 활성화되지 않았습니다",
  );
  await setLabeledNumberValue(cdp, "404 임계치", 20);
  await setLabeledNumberValue(cdp, "5xx 임계치", 10);
  await waitForCondition(
    cdp,
    `(() => {
      const labels = Array.from(document.querySelectorAll('[data-testid="security-alert-settings-card"] label'));
      const notFound = labels.find((label) => label.textContent?.includes('404 임계치'))?.querySelector('input');
      const serverError = labels.find((label) => label.textContent?.includes('5xx 임계치'))?.querySelector('input');
      return notFound?.value === '20' && serverError?.value === '10';
    })()`,
    timeoutMs,
    "Manager API 오류 현재 임계치를 시험값으로 바꾸지 못했습니다",
  );
  const pathSet = await evaluate(cdp, `(() => {
    const textarea = document.querySelector('textarea[aria-label="임계치 제외 경로"]');
    if (!(textarea instanceof HTMLTextAreaElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    setter?.call(textarea, '/api/health');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  assert.equal(pathSet, true, "Manager API 오류 제외 경로를 입력하지 못했습니다");
  await waitForCondition(
    cdp,
    `document.querySelector('textarea[aria-label="임계치 제외 경로"]')?.value === '/api/health'`,
    timeoutMs,
    "Manager API 오류 제외 경로 입력이 반영되지 않았습니다",
  );
  const complete = profile.id === "mobile-dark";
  const fixture = buildManagerHttpPreviewFixture(complete);
  await cdp.send("Fetch.enable", {
    patterns: [{ requestStage: "Request", urlPattern: "*/api/v1/docker/http-errors/preview" }],
  });
  try {
    const requestPaused = cdp.waitFor("Fetch.requestPaused", timeoutMs);
    const requested = await evaluate(cdp, `(() => {
      const button = document.querySelector('[data-testid="manager-http-error-preview-button"]');
      button?.click();
      return Boolean(button);
    })()`);
    assert.equal(requested, true, "Manager API 오류 권장값 계산을 실행하지 못했습니다");
    const request = await requestPaused;
    const requestBody = JSON.parse(request.request.postData || "{}");
    assert.deepEqual(requestBody.excluded_paths, ["/api/health"]);
    await cdp.send("Fetch.fulfillRequest", {
      requestId: request.requestId,
      responseCode: 200,
      responseHeaders: [{ name: "Content-Type", value: "application/json" }],
      body: Buffer.from(JSON.stringify(fixture)).toString("base64"),
    });
  } finally {
    await cdp.send("Fetch.disable");
  }
  await waitForCondition(
    cdp,
    `Boolean(document.querySelector('[data-testid="manager-http-error-preview"]'))`,
    timeoutMs,
    "Manager API 오류 권장값 계산 결과가 표시되지 않았습니다",
  );
  const snapshot = await evaluate(cdp, `(() => {
    const result = document.querySelector('[data-testid="manager-http-error-preview"]');
    const comparison = document.querySelector('[data-testid="manager-http-threshold-comparison"]');
    const guidance = document.querySelector('[data-testid="manager-http-sample-guidance"]');
    return {
      comparisonCurrent404: comparison?.getAttribute('data-current-not-found'),
      comparisonCurrent5xx: comparison?.getAttribute('data-current-server-error'),
      comparisonText: comparison?.textContent || '',
      documentWidth: document.documentElement.scrollWidth,
      expected404: result?.getAttribute('data-recommended-not-found'),
      expected5xx: result?.getAttribute('data-recommended-server-error'),
      sampleComplete: guidance?.getAttribute('data-sample-complete'),
      sampleCoverage: Number(document.querySelector('[data-testid="manager-http-sample-coverage"]')
        ?.getAttribute('data-sample-coverage')),
      text: result?.textContent || '',
      viewportWidth: window.innerWidth,
    };
  })()`);
  assert.match(snapshot.text, /권장 임계치/, "Manager API 오류 권장 임계치가 없습니다");
  assert.match(snapshot.text, /로그 관측 시작:/, "Manager API 오류 로그 표본 시작 시각이 없습니다");
  assert.match(snapshot.text, /표본 충족률/, "Manager API 오류 로그 표본 충족률이 없습니다");
  assert.match(snapshot.text, /24시간 충족 후|24시간 표본이 충족/, "Manager API 오류 표본 안내가 없습니다");
  assert.match(snapshot.text, /\/api\/health/, "제외 경로별 오류 미리보기가 없습니다");
  assert.match(snapshot.text, /최근 오류:/, "제외 경로의 최근 오류 시각이 없습니다");
  assert.ok(
    Number.isInteger(snapshot.sampleCoverage) &&
      snapshot.sampleCoverage >= 0 &&
      snapshot.sampleCoverage <= 100,
    "Manager API 오류 로그 표본 충족률이 올바르지 않습니다",
  );
  assert.equal(snapshot.sampleComplete, complete ? "true" : "false");
  if (complete) {
    assert.equal(snapshot.comparisonCurrent404, "20");
    assert.equal(snapshot.comparisonCurrent5xx, "10");
    assert.match(snapshot.comparisonText, /404 20건 → 32건 \(12건 상향\)/);
    assert.match(snapshot.comparisonText, /5xx 10건 → 8건 \(2건 하향\)/);
  } else {
    assert.equal(snapshot.comparisonText, "", "초기 표본에 현재·권장 임계치 비교가 표시됐습니다");
  }
  assert.ok(snapshot.documentWidth <= snapshot.viewportWidth + 1, "권장값 결과가 화면 폭을 넘습니다");
  await captureVisualScreenshot({
    artifactDir,
    cdp,
    name: `${profile.id}-manager-http-error-preview`,
  });

  const applied = await evaluate(cdp, `(() => {
    const card = document.querySelector('[data-testid="security-alert-settings-card"]');
    const button = Array.from(card?.querySelectorAll('button') || []).find(
      (item) => item.textContent?.includes('권장값 적용')
    );
    button?.click();
    return Boolean(button);
  })()`);
  assert.equal(applied, true, "Manager API 오류 권장값 적용 버튼을 찾지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const card = document.querySelector('[data-testid="security-alert-settings-card"]');
      const labels = Array.from(card?.querySelectorAll('label') || []);
      const notFound = labels.find((label) => label.textContent?.includes('404 임계치'))?.querySelector('input');
      const serverError = labels.find((label) => label.textContent?.includes('5xx 임계치'))?.querySelector('input');
      return notFound?.value === ${JSON.stringify(snapshot.expected404)} &&
        serverError?.value === ${JSON.stringify(snapshot.expected5xx)};
    })()`,
    timeoutMs,
    "Manager API 오류 권장값이 입력 필드에 적용되지 않았습니다",
  );
  await evaluate(cdp, `(() => {
    const card = document.querySelector('[data-testid="security-alert-settings-card"]');
    const cancel = Array.from(card?.querySelectorAll('button') || []).find(
      (button) => button.textContent?.includes('취소')
    );
    cancel?.click();
  })()`);
  await waitForCondition(
    cdp,
    `!document.querySelector('[data-testid="manager-http-error-preview-button"]')`,
    timeoutMs,
    "Manager API 오류 설정 편집이 닫히지 않았습니다",
  );
  return true;
}

async function checkManagerHttpErrorPreviewApi(cdp) {
  const preview = await evaluate(cdp, `(async () => {
    const pair = document.cookie.split('; ').find((item) => item.startsWith('tm_csrf='));
    const csrf = pair ? decodeURIComponent(pair.slice('tm_csrf='.length)) : '';
    const response = await fetch('/api/v1/docker/http-errors/preview', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ window_minutes: 15, excluded_paths: ['/api/health'] }),
    });
    const body = await response.json();
    return { body, ok: response.ok };
  })()`);
  assert.equal(preview.ok, true, "Manager API 오류 권장값 API 요청에 실패했습니다");
  assert.equal(preview.body.available, true, "Manager API 오류 권장값 로그를 읽지 못했습니다");
  assert.equal(preview.body.window_minutes, 15, "Manager API 오류 권장값 구간이 다릅니다");
  assert.ok(
    Number.isInteger(preview.body.sample_coverage_percent) &&
      preview.body.sample_coverage_percent >= 0 &&
      preview.body.sample_coverage_percent <= 100,
    "Manager API 오류 권장값 표본 충족률이 올바르지 않습니다",
  );
  assert.ok(
    Number.isInteger(preview.body.recommended_not_found_threshold) &&
      Number.isInteger(preview.body.recommended_server_error_threshold),
    "Manager API 오류 권장 임계치가 올바르지 않습니다",
  );
  assert.equal(preview.body.excluded_paths?.[0]?.path, "/api/health");
  assert.ok(
    Object.hasOwn(preview.body.excluded_paths?.[0] || {}, "last_seen_at"),
    "제외 경로의 최근 오류 시각 필드가 없습니다",
  );
}

async function setSelectValue(cdp, selector, value) {
  const changed = await evaluate(cdp, `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!(element instanceof HTMLSelectElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    setter?.call(element, ${JSON.stringify(value)});
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, `${selector}: select를 찾지 못했습니다`);
}

async function setInputValue(cdp, selector, value) {
  const changed = await evaluate(cdp, `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!(element instanceof HTMLInputElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(element, ${JSON.stringify(value)});
    element.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, `${selector}: input을 찾지 못했습니다`);
}

async function setLabeledNumberValue(cdp, label, value) {
  const changed = await evaluate(cdp, `(() => {
    const labels = Array.from(document.querySelectorAll('[data-testid="security-alert-settings-card"] label'));
    const input = labels.find((item) => item.textContent?.includes(${JSON.stringify(label)}))
      ?.querySelector('input[type="number"]');
    if (!(input instanceof HTMLInputElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, ${JSON.stringify(String(value))});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, `${label}: 숫자 입력을 찾지 못했습니다`);
}
