import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

const CUSTOM_FILENAME = "운영 / 실패 정보";
const STORAGE_KEY = "traefik-manager:smoke-failure-metadata-export-filename";

export async function prepareSmokeFailureMetadataExportFilename({ cdp }) {
  const stored = await evaluate(cdp, `(async () => {
    const filename = document.querySelector('[data-testid="smoke-failure-metadata-export-filename"]');
    if (!(filename instanceof HTMLInputElement)) return null;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!setValue) return null;
    setValue.call(filename, ${JSON.stringify(CUSTOM_FILENAME)});
    filename.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
  })()`);
  assert.equal(stored, CUSTOM_FILENAME, "실패 정보 내보내기 파일명이 브라우저에 저장되지 않았습니다");
}

export async function checkSmokeFailureMetadataExport({ cdp, customRange, timeoutMs }) {
  await waitForCondition(
    cdp,
    `document.querySelector('[data-testid="smoke-failure-metadata-export-filename"]')?.value === ${JSON.stringify(CUSTOM_FILENAME)}`,
    timeoutMs,
    "실패 정보 내보내기 파일명이 새로고침 후 복원되지 않았습니다",
  );
  const exported = await evaluate(cdp, `(async () => {
    const management = document.querySelector('[data-testid="smoke-failure-metadata-management"]');
    const filename = management?.querySelector('[data-testid="smoke-failure-metadata-export-filename"]');
    if (!(filename instanceof HTMLInputElement) || filename.value !== ${JSON.stringify(CUSTOM_FILENAME)}) return null;

    const capture = async (testId) => {
      const button = management?.querySelector('[data-testid="' + testId + '"]');
      if (!(button instanceof HTMLButtonElement) || button.disabled) return null;
      const originalCreateObjectUrl = URL.createObjectURL;
      const originalClick = HTMLAnchorElement.prototype.click;
      let blob = null;
      let outputFilename = '';
      try {
        URL.createObjectURL = (value) => { blob = value; return 'blob:smoke-failure-metadata'; };
        HTMLAnchorElement.prototype.click = function () { outputFilename = this.download; };
        button.click();
        return { content: blob ? await blob.text() : '', filename: outputFilename };
      } finally {
        URL.createObjectURL = originalCreateObjectUrl;
        HTMLAnchorElement.prototype.click = originalClick;
      }
    };

    const filteredCsv = await capture('smoke-failure-metadata-filtered-csv');
    const filteredJson = await capture('smoke-failure-metadata-export');
    const selectVisible = management?.querySelector('[data-testid="smoke-failure-metadata-select-visible"]');
    if (!(selectVisible instanceof HTMLButtonElement) || selectVisible.disabled) return null;
    selectVisible.click();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const selectedCsv = await capture('smoke-failure-metadata-selected-csv');
    const selectedJson = await capture('smoke-failure-metadata-selected-export');
    return {
      filteredCsv,
      filteredJson,
      selectedCsv,
      selectedJson,
      storedFilename: localStorage.getItem(${JSON.stringify(STORAGE_KEY)}),
    };
  })()`);

  assert.ok(exported?.filteredCsv, "현재 필터 결과 CSV를 캡처하지 못했습니다");
  assert.ok(exported.filteredJson, "현재 필터 결과 JSON을 캡처하지 못했습니다");
  assert.ok(exported.selectedCsv, "선택 실패 정보 CSV를 캡처하지 못했습니다");
  assert.ok(exported.selectedJson, "선택 실패 정보 JSON을 캡처하지 못했습니다");
  assert.equal(exported.storedFilename, CUSTOM_FILENAME);
  assert.match(exported.filteredCsv.filename, /^운영-실패-정보-filtered-\d{4}-\d{2}-\d{2}\.csv$/);
  assert.match(exported.filteredJson.filename, /^운영-실패-정보-filtered-\d{4}-\d{2}-\d{2}\.json$/);
  assert.match(exported.selectedCsv.filename, /^운영-실패-정보-selected-\d{4}-\d{2}-\d{2}\.csv$/);
  assert.match(exported.selectedJson.filename, /^운영-실패-정보-selected-\d{4}-\d{2}-\d{2}\.json$/);
  const filteredPayload = JSON.parse(exported.filteredJson.content);
  assert.equal(filteredPayload.metadata.schema_version, 2);
  assert.equal(filteredPayload.metadata.filters.query, "관리자");
  assert.equal(filteredPayload.metadata.filters.sort, "run_asc");
  for (const result of [exported.filteredCsv, exported.selectedCsv]) {
    assert.match(result.content, /^"run_id","failure_type","captured_at"/);
    assert.match(result.content, /"987","login"/);
    assert.doesNotMatch(result.content, /"986","external_api"/);
  }
  assert.match(
    exported.filteredCsv.content,
    /"filter_type","filter_period","filter_start_date","filter_end_date","filter_timezone","filter_query","filter_sort"/,
  );
  assert.match(
    exported.filteredCsv.content,
    new RegExp(`"login","custom","${customRange.startDate}","${customRange.endDate}",`),
  );
  assert.match(exported.filteredCsv.content, /,"관리자","run_asc"\r?\n/);
}
