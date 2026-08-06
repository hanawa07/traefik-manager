"use client";

import { BookmarkPlus, Check, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import type { SmokeFailureMetadataFilters } from "@/features/settings/lib/smokeFailureMetadataFilters";
import {
  normalizeSmokeFailureMetadataSavedFilterName,
  parseSmokeFailureMetadataSavedFilters,
  removeSmokeFailureMetadataSavedFilter,
  SMOKE_FAILURE_METADATA_SAVED_FILTER_NAME_LIMIT,
  SMOKE_FAILURE_METADATA_SAVED_FILTERS_STORAGE_KEY,
  upsertSmokeFailureMetadataSavedFilter,
  type SmokeFailureMetadataSavedFilter,
} from "@/features/settings/lib/smokeFailureMetadataSavedFilters";

interface SmokeFailureMetadataSavedFiltersProps {
  filters: SmokeFailureMetadataFilters;
  onApply: (filters: SmokeFailureMetadataFilters) => void;
}

export function SmokeFailureMetadataSavedFilters({
  filters,
  onApply,
}: SmokeFailureMetadataSavedFiltersProps) {
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");
  const [savedFilters, setSavedFilters] = useState<SmokeFailureMetadataSavedFilter[]>([]);
  const [selectedName, setSelectedName] = useState("");

  useEffect(() => {
    try {
      setSavedFilters(
        parseSmokeFailureMetadataSavedFilters(
          localStorage.getItem(SMOKE_FAILURE_METADATA_SAVED_FILTERS_STORAGE_KEY),
        ),
      );
    } catch {
      setNotice("브라우저에서 저장 필터를 불러오지 못했습니다.");
    }
  }, []);

  const persist = (next: SmokeFailureMetadataSavedFilter[]): boolean => {
    try {
      localStorage.setItem(
        SMOKE_FAILURE_METADATA_SAVED_FILTERS_STORAGE_KEY,
        JSON.stringify(next),
      );
      setSavedFilters(next);
      return true;
    } catch {
      setNotice("브라우저에 저장 필터를 기록하지 못했습니다.");
      return false;
    }
  };

  const save = () => {
    const normalizedName = normalizeSmokeFailureMetadataSavedFilterName(name);
    if (!normalizedName) {
      setNotice("저장할 필터 이름을 입력하세요.");
      return;
    }
    const next = upsertSmokeFailureMetadataSavedFilter(savedFilters, {
      filters,
      name: normalizedName,
    });
    if (!persist(next)) return;
    setName(normalizedName);
    setSelectedName(normalizedName);
    setNotice(`‘${normalizedName}’ 필터를 저장했습니다.`);
  };

  const apply = () => {
    const selected = savedFilters.find((item) => item.name === selectedName);
    if (!selected) return;
    onApply(selected.filters);
    setNotice(`‘${selected.name}’ 필터를 적용했습니다.`);
  };

  const remove = () => {
    if (!selectedName) return;
    const next = removeSmokeFailureMetadataSavedFilter(savedFilters, selectedName);
    if (!persist(next)) return;
    setNotice(`‘${selectedName}’ 필터를 삭제했습니다.`);
    setName("");
    setSelectedName("");
  };

  return (
    <section
      className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-2.5 dark:border-slate-700 dark:bg-slate-950/70"
      data-testid="smoke-failure-metadata-saved-filters"
    >
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto_auto] lg:items-end">
        <label className="grid gap-1 text-[11px] text-gray-500 dark:text-slate-400">
          저장 필터 이름
          <input
            className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            data-testid="smoke-failure-metadata-saved-filter-name"
            maxLength={SMOKE_FAILURE_METADATA_SAVED_FILTER_NAME_LIMIT}
            onChange={(event) => setName(event.target.value)}
            placeholder="예: 최근 로그인 실패"
            value={name}
          />
        </label>
        <label className="grid gap-1 text-[11px] text-gray-500 dark:text-slate-400">
          저장된 필터
          <select
            className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            data-testid="smoke-failure-metadata-saved-filter-select"
            onChange={(event) => {
              setSelectedName(event.target.value);
              setName(event.target.value);
            }}
            value={selectedName}
          >
            <option value="">저장된 필터 선택</option>
            {savedFilters.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="btn-secondary inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs"
          data-testid="smoke-failure-metadata-saved-filter-save"
          onClick={save}
          type="button"
        >
          <BookmarkPlus className="h-3.5 w-3.5" /> 저장
        </button>
        <button
          className="btn-secondary inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs"
          data-testid="smoke-failure-metadata-saved-filter-apply"
          disabled={!selectedName}
          onClick={apply}
          type="button"
        >
          <Check className="h-3.5 w-3.5" /> 적용
        </button>
        <button
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-rose-300 bg-white px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
          data-testid="smoke-failure-metadata-saved-filter-delete"
          disabled={!selectedName}
          onClick={remove}
          type="button"
        >
          <Trash2 className="h-3.5 w-3.5" /> 삭제
        </button>
      </div>
      <p
        aria-live="polite"
        className="mt-1.5 text-[11px] text-gray-500 dark:text-slate-400"
        data-testid="smoke-failure-metadata-saved-filter-notice"
      >
        {notice || "현재 유형·기간·날짜·정렬을 저장합니다. 같은 이름은 덮어씁니다."}
      </p>
    </section>
  );
}
