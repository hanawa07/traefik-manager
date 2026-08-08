import assert from "node:assert/strict";

import { checkManagerHttpLogStorageWarnings } from "./dashboard-visual-manager-log-storage.mjs";
import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

export async function checkManagerHttpErrorTrend({ cdp, timeoutMs = 15_000 }) {
  const snapshot = await evaluate(cdp, `(() => {
    const card = document.querySelector('[data-testid="manager-http-error-trend"]');
    const chart = document.querySelector('[data-testid="manager-http-error-chart-scroll"]');
    const correlation = document.querySelector('[data-testid="manager-http-deployment-correlation"]');
    const logStorage = document.querySelector('[data-testid="manager-http-log-storage"]');
    const monitor = document.querySelector('[data-testid="manager-http-error-monitor-status"]');
    const latencyMonitor = document.querySelector('[data-testid="manager-settings-history-latency-status"]');
    const route = document.querySelector('[data-testid="manager-route-status"]');
    const correlationAuditHrefs = Array.from(
      correlation?.querySelectorAll('[data-deployment-audit-link="true"]') || [],
    ).map((link) => link.getAttribute('href') || '');
    return card ? {
      available: card.getAttribute('data-http-error-available'),
      bucketCount: card.querySelectorAll('[data-http-error-bucket="true"]').length,
      chartScrollWidth: chart?.scrollWidth ?? 0,
      chartWidth: chart?.clientWidth ?? 0,
      correlationAuditHrefs,
      correlationCount: Number(correlation?.getAttribute('data-correlation-count')),
      correlationText: correlation?.textContent || '',
      managerApiAlert: document.querySelector('[data-testid="manager-health-alert-banner"]')
        ?.getAttribute('data-manager-api-alert'),
      managerApiAuditHref: document.querySelector('[data-testid="manager-api-audit-link"]')
        ?.getAttribute('href'),
      sampleCoverage: Number(card.getAttribute('data-http-sample-coverage')),
      sampleReady: Boolean(document.querySelector('[data-testid="manager-http-sample-ready"]')),
      monitorStatus: monitor?.getAttribute('data-http-error-monitor-status'),
      latencyStatus: latencyMonitor?.getAttribute('data-settings-history-latency-status'),
      latencyText: latencyMonitor?.textContent || '',
      route: route ? {
        activeSlot: route.getAttribute('data-route-active-slot'),
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
  assert.ok(snapshot.route, "Manager file-provider 라우터 상태가 없습니다");
  assert.ok(
    ["single", "blue", "green"].includes(snapshot.route.activeSlot),
    "Manager 활성 슬롯이 올바르지 않습니다",
  );
  assert.equal(snapshot.route.healthy, "true", "Manager file-provider 라우터가 정상이 아닙니다");
  assert.equal(snapshot.route.provider, "file", "Manager 라우터 provider가 file이 아닙니다");
  assert.equal(snapshot.route.upstreamStatus, "UP", "Manager 라우터 upstream이 UP이 아닙니다");
  assert.equal(snapshot.available, "true", "Manager API 오류 로그를 조회하지 못했습니다");
  assert.equal(snapshot.bucketCount, 24, "Manager API 오류 추이가 24개 시간 구간이 아닙니다");
  assert.ok(snapshot.chartScrollWidth >= snapshot.chartWidth, "Manager API 오류 차트 폭이 올바르지 않습니다");
  assert.match(snapshot.text, /관측 시작:/, "Manager API 오류 로그 관측 시각이 없습니다");
  assert.ok(Number.isInteger(snapshot.correlationCount) && snapshot.correlationCount >= 0);
  assert.match(
    snapshot.correlationText,
    /배포 시작 1분 전부터 완료 2분 후까지/,
    "Manager API 오류와 배포 시각의 상관관계 설명이 없습니다",
  );
  assert.equal(
    snapshot.correlationAuditHrefs.length,
    snapshot.correlationCount,
    "배포 상관관계별 감사 로그 링크 수가 올바르지 않습니다",
  );
  assert.ok(
    snapshot.correlationAuditHrefs.every((href) =>
      /^\/dashboard\/audit\?start_date=\d{4}-\d{2}-\d{2}&end_date=\d{4}-\d{2}-\d{2}$/.test(href),
    ),
    "배포 상관관계 감사 로그 링크의 UTC 날짜 범위가 올바르지 않습니다",
  );
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
  assert.ok(
    ["disabled", "pending", "unavailable", "sampling", "breached", "healthy"].includes(snapshot.latencyStatus),
    "설정 이력 API p95 감지 상태가 올바르지 않습니다",
  );
  assert.match(snapshot.latencyText, /최근 60분.*p95.*750ms.*표본/, "설정 이력 API p95 운영 지표가 없습니다");
  if (["breached", "unavailable"].includes(snapshot.managerApiAlert)) {
    assert.equal(
      snapshot.managerApiAuditHref,
      "/dashboard/audit?filter=manager_health&manager_source=api&period=90&expand=latest",
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
