import assert from "node:assert/strict";

import {
  captureHistoryDownload,
  checkExportButtonCount,
  checkExportFormatHelp,
  clickP95Filter,
  waitForExportToast,
} from "./dashboard-visual-manager-deployment-export-controls.mjs";
import {
  formatDateInput,
  setDateInput,
} from "./dashboard-visual-manager-deployment-period.mjs";
import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

export async function checkManagerDeploymentHistoryExports({ cdp, timeoutMs }) {
  await checkExportFormatHelp({ cdp, timeoutMs });
  await checkExportButtonCount(cdp, 1);
  const json = await captureHistoryDownload(cdp, "json");
  assert.match(json.filename, /deployments-archive-30d-rolled_back-\d{4}-\d{2}-\d{2}\.json$/);
  const payload = JSON.parse(json.text);
  assert.match(payload.metadata.exported_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(payload.metadata.result_count, 1);
  assert.equal(payload.metadata.schema_version, 5);
  assert.equal(typeof payload.metadata.timezone, "string");
  assert.ok(payload.metadata.timezone);
  assert.deepEqual(payload.metadata.filters, {
    archive_sample: "detailed",
    bottleneck_threshold_ms: 60_000,
    date_from: null,
    date_to: null,
    failure_stage: "public_probe",
    period: "30",
    search: "probe failure",
    source: "archive",
    speed: "all",
    status: "rolled_back",
  });
  assert.equal(payload.entries.length, 1, "Manager JSON 내보내기에 현재 필터가 반영되지 않았습니다");
  assert.equal(payload.entries[0].failure_stage, "public_probe");
  assert.equal(payload.entries[0].stage_durations_ms.public_probe, 18_000);
  await waitForExportToast({
    cdp,
    filename: json.filename,
    filterSummary: '보관 이력 · 상세 표본 · 최근 30일 · 자동 롤백 · 단계 공개 health probe · 검색 "probe failure"',
    format: "JSON",
    timeoutMs,
  });

  const dateFrom = formatDateInput(5);
  const dateTo = formatDateInput(0);
  await setDateInput({ cdp, kind: "from", timeoutMs, value: dateFrom });
  await setDateInput({ cdp, kind: "to", timeoutMs, value: dateTo });
  await checkExportButtonCount(cdp, 1);
  const customDateJson = await captureHistoryDownload(cdp, "json");
  assert.match(
    customDateJson.filename,
    new RegExp(`deployments-archive-${dateFrom}_to_${dateTo}-rolled_back-\\d{4}-\\d{2}-\\d{2}\\.json$`),
  );
  const customDatePayload = JSON.parse(customDateJson.text);
  assert.deepEqual(
    {
      date_from: customDatePayload.metadata.filters.date_from,
      date_to: customDatePayload.metadata.filters.date_to,
      period: customDatePayload.metadata.filters.period,
    },
    { date_from: dateFrom, date_to: dateTo, period: "all" },
  );
  await waitForExportToast({
    cdp,
    filename: customDateJson.filename,
    filterSummary: `보관 이력 · 상세 표본 · 기간 ${dateFrom}~${dateTo} · 자동 롤백`,
    format: "JSON",
    timeoutMs,
  });

  await evaluate(cdp, `document.querySelector('[data-history-filter-reset]')?.click()`);
  await waitForCondition(
    cdp,
    `(() => {
      const params = new URLSearchParams(location.search);
      return document.querySelectorAll(
        '[data-history-source="archive"] li[data-deployment-status]',
      ).length === 2 && !params.has('deployment_q') &&
        !params.has('deployment_period') && !params.has('deployment_from') &&
        !params.has('deployment_to') && !params.has('deployment_status') &&
        !params.has('deployment_speed') && !params.has('deployment_stage') &&
        !params.has('deployment_archive_sample') &&
        !params.has('deployment_bottleneck_ms') &&
        params.get('deployment_source') === 'archive';
    })()`,
    timeoutMs,
    "Manager 배포 이력 필터 초기화가 적용되지 않았습니다",
  );
  await checkExportButtonCount(cdp, 2);
  const csv = await captureHistoryDownload(cdp, "csv");
  assert.match(csv.filename, /deployments-archive-all-time-all-\d{4}-\d{2}-\d{2}\.csv$/);
  assert.deepEqual(csv.bytes, [239, 187, 191], "Manager CSV UTF-8 BOM이 없습니다");
  assert.match(csv.text, /^metadata,value\r\n/);
  assert.match(csv.text, /\r\nschema_version,"5"\r\n/);
  assert.match(csv.text, /\r\ntimezone,"[^"]+"\r\n/);
  assert.match(csv.text, /\r\nresult_count,"2"\r\n/);
  assert.match(csv.text, /\r\nfilter_source,"archive"\r\n/);
  assert.match(csv.text, /\r\nfilter_archive_sample,"all"\r\n/);
  assert.match(csv.text, /\r\nfilter_bottleneck_threshold_ms,"60000"\r\n/);
  assert.match(csv.text, /\r\nfilter_speed,"all"\r\n/);
  assert.match(csv.text, /\r\nfilter_period,"all"\r\n/);
  assert.match(csv.text, /\r\n\r\nstatus,from_slot,to_slot,/);
  assert.match(csv.text, /failure_reason,stage_durations_ms,alert_request_status/);
  assert.match(csv.text, /alert_run_error,archive_sample\r\n/);
  assert.match(csv.text, /\{\"\"prepare\"\":10000,\"\"build\"\":110000\}/);
  assert.match(csv.text, /"'=archive fixture probe failure"/);
  assert.match(csv.text, /"'\+archive fixture build failure"/);
  await waitForExportToast({
    cdp,
    filename: csv.filename,
    filterSummary: "보관 이력 · 전체 기간 · 전체",
    format: "CSV",
    timeoutMs,
  });

  await evaluate(cdp, `document.querySelector('[data-history-source-filter="all"]')?.click()`);
  await waitForCondition(
    cdp,
    `document.querySelectorAll(
      '[data-history-source="all"] li[data-deployment-status]',
    ).length === 3`,
    timeoutMs,
    "Manager 통합 이력 내보내기 source를 선택하지 못했습니다",
  );
  await checkExportButtonCount(cdp, 3);
  const combinedJson = await captureHistoryDownload(cdp, "json");
  assert.match(combinedJson.filename, /deployments-all-all-time-all-\d{4}-\d{2}-\d{2}\.json$/);
  const combinedPayload = JSON.parse(combinedJson.text);
  assert.equal(combinedPayload.metadata.filters.source, "all");
  assert.equal(combinedPayload.metadata.result_count, 3);
  assert.deepEqual(
    combinedPayload.entries.map((entry) => entry.source),
    ["current", "archive", "archive"],
  );
  const combinedCsv = await captureHistoryDownload(cdp, "csv");
  assert.match(combinedCsv.text, /\r\nfilter_source,"all"\r\n/);
  assert.match(combinedCsv.text, /\r\n\r\nsource,status,from_slot,to_slot,/);
  assert.match(combinedCsv.text, /"current","success"/);
  assert.equal(combinedCsv.text.match(/"archive"/g)?.length, 2);

  await clickP95Filter({ cdp, timeoutMs });
  await checkExportButtonCount(cdp, 1);
  const slowJson = await captureHistoryDownload(cdp, "json");
  assert.match(
    slowJson.filename,
    /deployments-all-all-time-all-slow-p95-\d{4}-\d{2}-\d{2}\.json$/,
  );
  const slowPayload = JSON.parse(slowJson.text);
  assert.equal(slowPayload.metadata.filters.speed, "p95");
  assert.equal(slowPayload.metadata.result_count, 1);
  assert.deepEqual(
    slowPayload.entries.map((entry) => entry.source),
    ["archive"],
  );
  await waitForExportToast({
    cdp,
    filename: slowJson.filename,
    filterSummary: "현재·보관 통합 · 전체 기간 · 전체 · 속도 P95 초과",
    format: "JSON",
    timeoutMs,
  });
  await evaluate(cdp, `document.querySelector('[data-history-filter-reset]')?.click()`);
  await waitForCondition(
    cdp,
    `!new URLSearchParams(location.search).has('deployment_speed') &&
      document.querySelectorAll(
        '[data-history-source="all"] li[data-deployment-status]',
      ).length === 3`,
    timeoutMs,
    "Manager 느린 배포 내보내기 필터를 초기화하지 못했습니다",
  );
}
