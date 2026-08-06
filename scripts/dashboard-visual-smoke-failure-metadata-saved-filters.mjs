import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

const VISUAL_PRESET_NAME = "시각 스모크 필터";

export async function checkSmokeFailureMetadataSavedFilters({ cdp, timeoutMs }) {
  const saved = await evaluate(cdp, `(() => {
    const name = document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-name"]');
    const button = document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-save"]');
    if (!(name instanceof HTMLInputElement) || !(button instanceof HTMLButtonElement)) return false;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!setValue) return false;
    setValue.call(name, ${JSON.stringify(VISUAL_PRESET_NAME)});
    name.dispatchEvent(new Event('input', { bubbles: true }));
    button.click();
    return true;
  })()`);
  assert.equal(saved, true, "실패 정보 필터 프리셋을 저장하지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const select = document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-select"]');
      const notice = document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-notice"]');
      return select?.value === ${JSON.stringify(VISUAL_PRESET_NAME)} &&
        notice?.textContent?.includes('필터를 저장했습니다');
    })()`,
    timeoutMs,
    "저장한 실패 정보 필터가 목록에 표시되지 않았습니다",
  );

  const changed = await evaluate(cdp, `(() => {
    const type = document.querySelector('[data-testid="smoke-failure-metadata-type-filter"]');
    if (!(type instanceof HTMLSelectElement)) return false;
    type.value = 'external_api';
    type.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, "저장 필터 적용 전 유형을 변경하지 못했습니다");
  await waitForCondition(
    cdp,
    `new URLSearchParams(location.search).get('smoke_metadata_type') === 'external_api'`,
    timeoutMs,
    "저장 필터 적용 전 유형 변경이 반영되지 않았습니다",
  );

  const applied = await evaluate(cdp, `(() => {
    const button = document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-apply"]');
    if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
    button.click();
    return true;
  })()`);
  assert.equal(applied, true, "저장한 실패 정보 필터를 적용하지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const params = new URLSearchParams(location.search);
      return params.get('smoke_metadata_type') === 'login' &&
        params.get('smoke_metadata_period') === 'custom' &&
        params.get('smoke_metadata_sort') === 'run_asc' &&
        document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-notice"]')?.textContent?.includes('필터를 적용했습니다');
    })()`,
    timeoutMs,
    "저장 필터가 화면과 URL에 일괄 적용되지 않았습니다",
  );

  const removed = await evaluate(cdp, `(() => {
    const button = document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-delete"]');
    if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
    button.click();
    return true;
  })()`);
  assert.equal(removed, true, "저장한 실패 정보 필터를 삭제하지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const select = document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-select"]');
      return select?.value === '' &&
        !Array.from(select?.options || []).some((option) => option.value === ${JSON.stringify(VISUAL_PRESET_NAME)});
    })()`,
    timeoutMs,
    "삭제한 실패 정보 필터가 목록에 남아 있습니다",
  );
}
