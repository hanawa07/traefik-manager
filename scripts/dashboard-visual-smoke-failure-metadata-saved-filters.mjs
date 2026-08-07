import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

const VISUAL_PRESET_NAME = "시각 스모크 필터";
const RENAMED_PRESET_NAME = "Z 시각 필터";
const SECONDARY_PRESET_NAME = "A 시각 필터";
const STORAGE_KEY = "traefik-manager:smoke-failure-metadata-saved-filters";
const SORT_STORAGE_KEY = "traefik-manager:smoke-failure-metadata-saved-filter-sort";

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

  const renamed = await evaluate(cdp, `(async () => {
    const name = document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-name"]');
    const button = document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-rename"]');
    if (!(name instanceof HTMLInputElement) || !(button instanceof HTMLButtonElement)) return false;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!setValue) return false;
    setValue.call(name, ${JSON.stringify(RENAMED_PRESET_NAME)});
    name.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (button.disabled) return false;
    button.click();
    return true;
  })()`);
  assert.equal(renamed, true, "저장 필터 이름을 변경하지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const select = document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-select"]');
      const notice = document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-notice"]');
      return select?.value === ${JSON.stringify(RENAMED_PRESET_NAME)} &&
        !Array.from(select?.options || []).some((option) => option.value === ${JSON.stringify(VISUAL_PRESET_NAME)}) &&
        notice?.textContent?.includes('이름을');
    })()`,
    timeoutMs,
    "변경한 저장 필터 이름이 목록에 반영되지 않았습니다",
  );

  const secondarySaved = await evaluate(cdp, `(() => {
    const name = document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-name"]');
    const button = document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-save"]');
    if (!(name instanceof HTMLInputElement) || !(button instanceof HTMLButtonElement)) return false;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!setValue) return false;
    setValue.call(name, ${JSON.stringify(SECONDARY_PRESET_NAME)});
    name.dispatchEvent(new Event('input', { bubbles: true }));
    button.click();
    return true;
  })()`);
  assert.equal(secondarySaved, true, "정렬 확인용 저장 필터를 추가하지 못했습니다");
  await waitForCondition(
    cdp,
    `document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-select"]')?.value === ${JSON.stringify(SECONDARY_PRESET_NAME)}`,
    timeoutMs,
    "정렬 확인용 저장 필터가 선택되지 않았습니다",
  );

  const sorted = await evaluate(cdp, `(() => {
    const sort = document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-sort"]');
    if (!(sort instanceof HTMLSelectElement)) return false;
    sort.value = 'name_desc';
    sort.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(sorted, true, "저장 필터 목록 정렬을 변경하지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const select = document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-select"]');
      const names = Array.from(select?.options || []).slice(1).map((option) => option.value);
      return JSON.stringify(names) === ${JSON.stringify(JSON.stringify([RENAMED_PRESET_NAME, SECONDARY_PRESET_NAME]))};
    })()`,
    timeoutMs,
    "저장 필터 이름 내림차순이 목록에 반영되지 않았습니다",
  );

  const backup = await evaluate(cdp, `(async () => {
    const button = document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-backup"]');
    if (!(button instanceof HTMLButtonElement) || button.disabled) return null;
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalClick = HTMLAnchorElement.prototype.click;
    let blob = null;
    let filename = '';
    try {
      URL.createObjectURL = (value) => { blob = value; return 'blob:saved-filter-backup'; };
      HTMLAnchorElement.prototype.click = function () { filename = this.download; };
      button.click();
      return { content: blob ? await blob.text() : '', filename };
    } finally {
      URL.createObjectURL = originalCreateObjectUrl;
      HTMLAnchorElement.prototype.click = originalClick;
    }
  })()`);
  assert.ok(backup, "저장 필터 JSON 백업을 캡처하지 못했습니다");
  assert.match(
    backup.filename,
    /^traefik-manager-smoke-failure-filters-\d{4}-\d{2}-\d{2}\.json$/,
  );
  const backupPayload = JSON.parse(backup.content);
  assert.equal(backupPayload.schema_version, 1);
  assert.equal(backupPayload.sort, "name_desc");
  assert.deepEqual(
    backupPayload.filters.map(({ name }) => name),
    [SECONDARY_PRESET_NAME, RENAMED_PRESET_NAME],
  );

  const renamedSelected = await evaluate(cdp, `(() => {
    const select = document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-select"]');
    if (!(select instanceof HTMLSelectElement)) return false;
    select.value = ${JSON.stringify(RENAMED_PRESET_NAME)};
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(renamedSelected, true, "이름을 변경한 저장 필터를 선택하지 못했습니다");
  await waitForCondition(
    cdp,
    `document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-select"]')?.value === ${JSON.stringify(RENAMED_PRESET_NAME)}`,
    timeoutMs,
    "이름을 변경한 저장 필터 선택이 반영되지 않았습니다",
  );

  const changed = await evaluate(cdp, `(() => {
    const type = document.querySelector('[data-testid="smoke-failure-metadata-type-filter"]');
    const search = document.querySelector('[data-testid="smoke-failure-metadata-search"]');
    if (!(type instanceof HTMLSelectElement) || !(search instanceof HTMLInputElement)) return false;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!setValue) return false;
    type.value = 'external_api';
    type.dispatchEvent(new Event('change', { bubbles: true }));
    setValue.call(search, '외부');
    search.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, "저장 필터 적용 전 유형을 변경하지 못했습니다");
  await waitForCondition(
    cdp,
    `new URLSearchParams(location.search).get('smoke_metadata_type') === 'external_api' &&
      new URLSearchParams(location.search).get('smoke_metadata_q') === '외부'`,
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
        params.get('smoke_metadata_q') === '관리자' &&
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
        !Array.from(select?.options || []).some((option) => option.value === ${JSON.stringify(RENAMED_PRESET_NAME)});
    })()`,
    timeoutMs,
    "삭제한 실패 정보 필터가 목록에 남아 있습니다",
  );

  const merged = await evaluate(cdp, `(async () => {
    const input = document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-restore"]');
    const select = document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-select"]');
    const notice = document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-notice"]');
    if (!(input instanceof HTMLInputElement) || !(select instanceof HTMLSelectElement)) return null;
    const transfer = new DataTransfer();
    transfer.items.add(new File(
      [${JSON.stringify(backup.content)}],
      ${JSON.stringify(backup.filename)},
      { type: 'application/json' },
    ));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-restore-preview"]')) break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    const summary = document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-restore-summary"]');
    const backupSort = document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-restore-sort"]');
    const merge = document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-restore-mode-merge"]');
    const execute = document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-restore-execute"]');
    if (!(merge instanceof HTMLInputElement) || !(execute instanceof HTMLButtonElement)) return null;
    merge.click();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    execute.click();
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (!document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-restore-preview"]') &&
          notice?.textContent?.includes('병합했습니다')) break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    return {
      backupSort: backupSort?.textContent?.replace(/\s+/g, ' ').trim(),
      inputValue: input.value,
      names: Array.from(select.options).slice(1).map((option) => option.value),
      sort: localStorage.getItem(${JSON.stringify(SORT_STORAGE_KEY)}),
      storedNames: JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) || '[]').map((item) => item.name),
      summary: summary?.textContent?.replace(/\s+/g, ' ').trim(),
    };
  })()`);
  assert.deepEqual(
    merged,
    {
      backupSort: "백업 정렬: 이름 내림차순",
      inputValue: "",
      names: [RENAMED_PRESET_NAME, SECONDARY_PRESET_NAME],
      sort: "name_desc",
      storedNames: [SECONDARY_PRESET_NAME, RENAMED_PRESET_NAME],
      summary: "백업 2개 · 현재 1개 · 같은 이름 1개 · 결과 2개",
    },
    "저장 필터 JSON 백업을 미리보기 후 병합하지 못했습니다",
  );

  const allRemoved = await evaluate(cdp, `(async () => {
    const clearAll = document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-clear-all"]');
    const select = document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-select"]');
    if (!(clearAll instanceof HTMLButtonElement) || !(select instanceof HTMLSelectElement)) return null;
    const originalConfirm = window.confirm;
    let confirmation = '';
    try {
      window.confirm = (message) => { confirmation = message; return true; };
      clearAll.click();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return {
        confirmation,
        optionCount: select.options.length,
        stored: localStorage.getItem(${JSON.stringify(STORAGE_KEY)}),
      };
    } finally {
      window.confirm = originalConfirm;
    }
  })()`);
  assert.deepEqual(
    allRemoved,
    {
      confirmation: "저장 필터 2개를 모두 삭제할까요?",
      optionCount: 1,
      stored: "[]",
    },
    "저장 필터 전체 삭제를 확인 후 실행하지 못했습니다",
  );

  const restored = await evaluate(cdp, `(async () => {
    const input = document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-restore"]');
    const select = document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-select"]');
    const notice = document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-notice"]');
    if (!(input instanceof HTMLInputElement) || !(select instanceof HTMLSelectElement)) return null;
    const transfer = new DataTransfer();
    transfer.items.add(new File(
      [${JSON.stringify(backup.content)}],
      ${JSON.stringify(backup.filename)},
      { type: 'application/json' },
    ));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-restore-preview"]')) break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    const summary = document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-restore-summary"]');
    const replace = document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-restore-mode-replace"]');
    const execute = document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-restore-execute"]');
    if (!(replace instanceof HTMLInputElement) || !(execute instanceof HTMLButtonElement)) return null;
    const defaultReplace = replace.checked;
    const previewSummary = summary?.textContent?.replace(/\s+/g, ' ').trim();
    execute.click();
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (select.options.length === 3 && notice?.textContent?.includes('교체했습니다')) break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    return {
      defaultReplace,
      inputValue: input.value,
      names: Array.from(select.options).slice(1).map((option) => option.value),
      previewRemoved: !document.querySelector('[data-testid="smoke-failure-metadata-saved-filter-restore-preview"]'),
      sort: localStorage.getItem(${JSON.stringify(SORT_STORAGE_KEY)}),
      storedCount: JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) || '[]').length,
      summary: previewSummary,
    };
  })()`);
  assert.deepEqual(
    restored,
    {
      defaultReplace: true,
      inputValue: "",
      names: [RENAMED_PRESET_NAME, SECONDARY_PRESET_NAME],
      previewRemoved: true,
      sort: "name_desc",
      storedCount: 2,
      summary: "백업 2개 · 현재 0개 · 같은 이름 0개 · 결과 2개",
    },
    "저장 필터 JSON 백업을 미리보기 후 교체하지 못했습니다",
  );
}
