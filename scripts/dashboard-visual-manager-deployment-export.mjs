import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

export async function checkManagerDeploymentHistoryExports({ cdp, timeoutMs }) {
  const json = await captureHistoryDownload(cdp, "json");
  assert.match(json.filename, /deployments-archive-\d{4}-\d{2}-\d{2}\.json$/);
  const payload = JSON.parse(json.text);
  assert.match(payload.metadata.exported_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(payload.metadata.result_count, 1);
  assert.deepEqual(payload.metadata.filters, {
    date_from: null,
    date_to: null,
    failure_stage: "public_probe",
    period: "30",
    search: "probe failure",
    source: "archive",
    status: "rolled_back",
  });
  assert.equal(payload.entries.length, 1, "Manager JSON 내보내기에 현재 필터가 반영되지 않았습니다");
  assert.equal(payload.entries[0].failure_stage, "public_probe");
  await waitForExportToast({ cdp, filename: json.filename, format: "JSON", timeoutMs });

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
        !params.has('deployment_stage') &&
        params.get('deployment_source') === 'archive';
    })()`,
    timeoutMs,
    "Manager 배포 이력 필터 초기화가 적용되지 않았습니다",
  );
  const csv = await captureHistoryDownload(cdp, "csv");
  assert.match(csv.filename, /deployments-archive-\d{4}-\d{2}-\d{2}\.csv$/);
  assert.deepEqual(csv.bytes, [239, 187, 191], "Manager CSV UTF-8 BOM이 없습니다");
  assert.match(csv.text, /^metadata,value\r\n/);
  assert.match(csv.text, /\r\nresult_count,"2"\r\n/);
  assert.match(csv.text, /\r\nfilter_source,"archive"\r\n/);
  assert.match(csv.text, /\r\nfilter_period,"all"\r\n/);
  assert.match(csv.text, /\r\n\r\nstatus,from_slot,to_slot,/);
  assert.match(csv.text, /"'=archive fixture probe failure"/);
  assert.match(csv.text, /"'\+archive fixture build failure"/);
  await waitForExportToast({ cdp, filename: csv.filename, format: "CSV", timeoutMs });

  await evaluate(cdp, `document.querySelector('[data-history-source-filter="all"]')?.click()`);
  await waitForCondition(
    cdp,
    `document.querySelectorAll(
      '[data-history-source="all"] li[data-deployment-status]',
    ).length === 3`,
    timeoutMs,
    "Manager 통합 이력 내보내기 source를 선택하지 못했습니다",
  );
  const combinedJson = await captureHistoryDownload(cdp, "json");
  assert.match(combinedJson.filename, /deployments-all-\d{4}-\d{2}-\d{2}\.json$/);
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
