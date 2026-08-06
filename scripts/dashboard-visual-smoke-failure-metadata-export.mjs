import assert from "node:assert/strict";

import { evaluate } from "./dashboard-visual-runtime.mjs";

export async function checkSmokeFailureMetadataExport({ cdp, customRange }) {
  const exported = await evaluate(cdp, `(async () => {
    const management = document.querySelector('[data-testid="smoke-failure-metadata-management"]');
    const filename = management?.querySelector('[data-testid="smoke-failure-metadata-export-filename"]');
    if (!(filename instanceof HTMLInputElement)) return null;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!setValue) return null;
    setValue.call(filename, '운영 / 실패 정보');
    filename.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

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
    return { filteredCsv, filteredJson, selectedCsv, selectedJson };
  })()`);

  assert.ok(exported?.filteredCsv, "현재 필터 결과 CSV를 캡처하지 못했습니다");
  assert.ok(exported.filteredJson, "현재 필터 결과 JSON을 캡처하지 못했습니다");
  assert.ok(exported.selectedCsv, "선택 실패 정보 CSV를 캡처하지 못했습니다");
  assert.ok(exported.selectedJson, "선택 실패 정보 JSON을 캡처하지 못했습니다");
  assert.match(exported.filteredCsv.filename, /^운영-실패-정보-filtered-\d{4}-\d{2}-\d{2}\.csv$/);
  assert.match(exported.filteredJson.filename, /^운영-실패-정보-filtered-\d{4}-\d{2}-\d{2}\.json$/);
  assert.match(exported.selectedCsv.filename, /^운영-실패-정보-selected-\d{4}-\d{2}-\d{2}\.csv$/);
  assert.match(exported.selectedJson.filename, /^운영-실패-정보-selected-\d{4}-\d{2}-\d{2}\.json$/);
  for (const result of [exported.filteredCsv, exported.selectedCsv]) {
    assert.match(result.content, /^"run_id","failure_type","captured_at"/);
    assert.match(result.content, /"987","login"/);
    assert.doesNotMatch(result.content, /"986","external_api"/);
  }
  assert.match(
    exported.filteredCsv.content,
    /"filter_type","filter_period","filter_start_date","filter_end_date","filter_timezone"/,
  );
  assert.match(
    exported.filteredCsv.content,
    new RegExp(`"login","custom","${customRange.startDate}","${customRange.endDate}",`),
  );
}
