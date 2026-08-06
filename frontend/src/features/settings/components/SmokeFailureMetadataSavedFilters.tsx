"use client";

import { BookmarkPlus, Check, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import type { SmokeFailureMetadataFilters } from "@/features/settings/lib/smokeFailureMetadataFilters";
import {
  normalizeSmokeFailureMetadataSavedFilterName,
  parseSmokeFailureMetadataSavedFilterSort,
  parseSmokeFailureMetadataSavedFilters,
  removeSmokeFailureMetadataSavedFilter,
  renameSmokeFailureMetadataSavedFilter,
  SMOKE_FAILURE_METADATA_SAVED_FILTER_NAME_LIMIT,
  SMOKE_FAILURE_METADATA_SAVED_FILTER_SORT_STORAGE_KEY,
  SMOKE_FAILURE_METADATA_SAVED_FILTERS_STORAGE_KEY,
  sortSmokeFailureMetadataSavedFilters,
  upsertSmokeFailureMetadataSavedFilter,
  type SmokeFailureMetadataSavedFilter,
  type SmokeFailureMetadataSavedFilterSort,
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
  const [sort, setSort] = useState<SmokeFailureMetadataSavedFilterSort>("recent");
  const [selectedName, setSelectedName] = useState("");
  const displayedFilters = sortSmokeFailureMetadataSavedFilters(savedFilters, sort);

  useEffect(() => {
    try {
      setSavedFilters(
        parseSmokeFailureMetadataSavedFilters(
          localStorage.getItem(SMOKE_FAILURE_METADATA_SAVED_FILTERS_STORAGE_KEY),
        ),
      );
      setSort(
        parseSmokeFailureMetadataSavedFilterSort(
          localStorage.getItem(SMOKE_FAILURE_METADATA_SAVED_FILTER_SORT_STORAGE_KEY),
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

  const changeSort = (value: SmokeFailureMetadataSavedFilterSort) => {
    setSort(value);
    try {
      localStorage.setItem(SMOKE_FAILURE_METADATA_SAVED_FILTER_SORT_STORAGE_KEY, value);
    } catch {
      setNotice("브라우저에 목록 정렬 기준을 저장하지 못했습니다.");
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

  const rename = () => {
    if (!selectedName) return;
    const normalizedName = normalizeSmokeFailureMetadataSavedFilterName(name);
    if (!normalizedName) {
      setNotice("변경할 필터 이름을 입력하세요.");
      return;
    }
    if (
      savedFilters.some(
        (item) =>
          item.name !== selectedName &&
          item.name.toLowerCase() === normalizedName.toLowerCase(),
      )
    ) {
      setNotice(`‘${normalizedName}’ 이름이 이미 있습니다.`);
      return;
    }
    const next = renameSmokeFailureMetadataSavedFilter(
      savedFilters,
      selectedName,
      normalizedName,
    );
    if (!persist(next)) return;
    setName(normalizedName);
    setSelectedName(normalizedName);
    setNotice(`‘${selectedName}’ 필터 이름을 ‘${normalizedName}’(으)로 변경했습니다.`);
  };

  return (
    <section
      className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-2.5 dark:border-slate-700 dark:bg-slate-950/70"
      data-testid="smoke-failure-metadata-saved-filters"
    >
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
            {displayedFilters.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-[11px] text-gray-500 dark:text-slate-400">
          목록 정렬
          <select
            className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            data-testid="smoke-failure-metadata-saved-filter-sort"
            onChange={(event) =>
              changeSort(event.target.value as SmokeFailureMetadataSavedFilterSort)
            }
            value={sort}
          >
            <option value="recent">최근 저장순</option>
            <option value="name_asc">이름 오름차순</option>
            <option value="name_desc">이름 내림차순</option>
          </select>
        </label>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
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
          data-testid="smoke-failure-metadata-saved-filter-rename"
          disabled={
            !selectedName ||
            !normalizeSmokeFailureMetadataSavedFilterName(name) ||
            normalizeSmokeFailureMetadataSavedFilterName(name) === selectedName
          }
          onClick={rename}
          type="button"
        >
          <Pencil className="h-3.5 w-3.5" /> 이름 변경
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
        {notice || "현재 검색·유형·기간·날짜·정렬을 저장합니다. 같은 이름은 덮어씁니다."}
      </p>
    </section>
  );
}
