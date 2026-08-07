"use client";

import { BookmarkPlus, Check, Download, Pencil, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";

import type { SmokeFailureMetadataFilters } from "@/features/settings/lib/smokeFailureMetadataFilters";
import {
  buildSmokeFailureMetadataSavedFilterBackup,
  buildSmokeFailureMetadataSavedFiltersBackup,
  mergeSmokeFailureMetadataSavedFilters,
  normalizeSmokeFailureMetadataSavedFilterName,
  parseSmokeFailureMetadataSavedFilterSort,
  parseSmokeFailureMetadataSavedFilters,
  parseSmokeFailureMetadataSavedFiltersBackup,
  removeSmokeFailureMetadataSavedFilter,
  renameSmokeFailureMetadataSavedFilter,
  SMOKE_FAILURE_METADATA_SAVED_FILTER_LIMIT,
  SMOKE_FAILURE_METADATA_SAVED_FILTER_NAME_LIMIT,
  SMOKE_FAILURE_METADATA_SAVED_FILTER_BACKUP_SIZE_LIMIT,
  SMOKE_FAILURE_METADATA_SAVED_FILTER_SORT_STORAGE_KEY,
  SMOKE_FAILURE_METADATA_SAVED_FILTERS_STORAGE_KEY,
  sortSmokeFailureMetadataSavedFilters,
  upsertSmokeFailureMetadataSavedFilter,
  type SmokeFailureMetadataSavedFilter,
  type SmokeFailureMetadataSavedFilterSort,
  type SmokeFailureMetadataSavedFiltersBackup,
} from "@/features/settings/lib/smokeFailureMetadataSavedFilters";
import {
  SmokeFailureMetadataSavedFilterRestorePreview,
  type SmokeFailureMetadataSavedFilterRestoreMode,
} from "./SmokeFailureMetadataSavedFilterRestorePreview";

interface SmokeFailureMetadataSavedFiltersProps {
  filters: SmokeFailureMetadataFilters;
  onApply: (filters: SmokeFailureMetadataFilters) => void;
}

interface PendingRestore {
  backup: SmokeFailureMetadataSavedFiltersBackup;
  filename: string;
  key: string;
}

export function SmokeFailureMetadataSavedFilters({
  filters,
  onApply,
}: SmokeFailureMetadataSavedFiltersProps) {
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(null);
  const [savedFilters, setSavedFilters] = useState<SmokeFailureMetadataSavedFilter[]>([]);
  const [sort, setSort] = useState<SmokeFailureMetadataSavedFilterSort>("recent");
  const [selectedName, setSelectedName] = useState("");
  const normalizedName = normalizeSmokeFailureMetadataSavedFilterName(name);
  const displayedFilters = sortSmokeFailureMetadataSavedFilters(savedFilters, sort);
  const selectedFilter = savedFilters.find((item) => item.name === selectedName);
  const isNewFilterAtLimit =
    savedFilters.length >= SMOKE_FAILURE_METADATA_SAVED_FILTER_LIMIT &&
    Boolean(normalizedName) &&
    !savedFilters.some((item) => item.name.toLowerCase() === normalizedName.toLowerCase());

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

  const persist = (
    next: SmokeFailureMetadataSavedFilter[],
    nextSort?: SmokeFailureMetadataSavedFilterSort,
  ): boolean => {
    try {
      localStorage.setItem(
        SMOKE_FAILURE_METADATA_SAVED_FILTERS_STORAGE_KEY,
        JSON.stringify(next),
      );
      if (nextSort) {
        localStorage.setItem(SMOKE_FAILURE_METADATA_SAVED_FILTER_SORT_STORAGE_KEY, nextSort);
      }
      setSavedFilters(next);
      if (nextSort) setSort(nextSort);
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
    if (!normalizedName) {
      setNotice("저장할 필터 이름을 입력하세요.");
      return;
    }
    if (isNewFilterAtLimit) {
      setNotice("저장 필터는 최대 20개입니다. 기존 항목을 삭제하거나 같은 이름으로 덮어쓰세요.");
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
    if (!selectedFilter) return;
    onApply(selectedFilter.filters);
    setNotice(`‘${selectedFilter.name}’ 필터를 적용했습니다.`);
  };

  const remove = () => {
    if (!selectedName) return;
    const next = removeSmokeFailureMetadataSavedFilter(savedFilters, selectedName);
    if (!persist(next)) return;
    setNotice(`‘${selectedName}’ 필터를 삭제했습니다.`);
    setName("");
    setSelectedName("");
  };

  const clearAll = () => {
    const count = savedFilters.length;
    if (!count || !window.confirm(`저장 필터 ${count}개를 모두 삭제할까요?`)) return;
    if (!persist([])) return;
    setName("");
    setSelectedName("");
    setNotice(`저장 필터 ${count}개를 모두 삭제했습니다.`);
  };

  const downloadBackup = () => {
    try {
      downloadJsonBackup(buildSmokeFailureMetadataSavedFiltersBackup(savedFilters, sort));
      setNotice(`저장 필터 ${savedFilters.length}개를 JSON으로 백업했습니다.`);
    } catch {
      setNotice("저장 필터 JSON 백업을 만들지 못했습니다.");
    }
  };

  const downloadSelectedBackup = () => {
    if (!selectedFilter) return;
    try {
      downloadJsonBackup(buildSmokeFailureMetadataSavedFilterBackup(selectedFilter, sort));
      setNotice(`‘${selectedFilter.name}’ 필터를 개별 JSON으로 백업했습니다.`);
    } catch {
      setNotice("선택한 저장 필터 JSON 백업을 만들지 못했습니다.");
    }
  };

  const prepareRestoreBackup = async (file?: File) => {
    if (!file) return;
    setPendingRestore(null);
    if (file.size > SMOKE_FAILURE_METADATA_SAVED_FILTER_BACKUP_SIZE_LIMIT) {
      setNotice("저장 필터 백업 파일은 256KB 이하여야 합니다.");
      return;
    }
    try {
      const backup = parseSmokeFailureMetadataSavedFiltersBackup(await file.text());
      if (backup === null) {
        setNotice("지원하는 저장 필터 JSON 백업 파일이 아닙니다.");
        return;
      }
      setPendingRestore({
        backup,
        filename: file.name,
        key: `${file.name}:${file.size}:${file.lastModified}`,
      });
      setNotice("백업 내용을 확인한 뒤 교체 또는 병합을 선택하세요.");
    } catch {
      setNotice("저장 필터 JSON 백업을 읽지 못했습니다.");
    }
  };

  const restoreBackup = (mode: SmokeFailureMetadataSavedFilterRestoreMode) => {
    if (!pendingRestore) return;
    const merged = mode === "merge"
      ? mergeSmokeFailureMetadataSavedFilters(savedFilters, pendingRestore.backup.filters)
      : null;
    const next = merged?.filters ?? pendingRestore.backup.filters;
    if (!persist(next, pendingRestore.backup.sort)) return;
    setName("");
    setSelectedName("");
    setPendingRestore(null);
    setNotice(
      merged?.omitted.length
        ? `저장 필터를 JSON 백업과 병합했습니다. 결과 ${next.length}개이며, 20개 제한으로 ${merged.omitted.length}개를 제외했습니다.`
        : `저장 필터를 JSON 백업과 ${mode === "merge" ? "병합" : "교체"}했습니다. 결과 ${next.length}개입니다.`,
    );
  };

  const rename = () => {
    if (!selectedName) return;
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
          disabled={isNewFilterAtLimit}
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
            !normalizedName ||
            normalizedName === selectedName
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
        <button
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-rose-300 bg-white px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
          data-testid="smoke-failure-metadata-saved-filter-clear-all"
          disabled={!savedFilters.length}
          onClick={clearAll}
          type="button"
        >
          <Trash2 className="h-3.5 w-3.5" /> 전체 삭제
        </button>
      </div>
      {savedFilters.length >= SMOKE_FAILURE_METADATA_SAVED_FILTER_LIMIT ? (
        <p
          className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
          data-testid="smoke-failure-metadata-saved-filter-limit"
          role="status"
        >
          저장 필터가 최대 20개입니다. 새 이름을 저장하려면 기존 항목을 삭제하세요. 같은 이름은 덮어쓸 수 있습니다.
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-2 dark:border-slate-800">
        <button
          className="btn-secondary inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs"
          data-testid="smoke-failure-metadata-saved-filter-backup"
          disabled={!savedFilters.length}
          onClick={downloadBackup}
          type="button"
        >
          <Download className="h-3.5 w-3.5" /> 전체 JSON
        </button>
        <button
          className="btn-secondary inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs"
          data-testid="smoke-failure-metadata-saved-filter-backup-selected"
          disabled={!selectedFilter}
          onClick={downloadSelectedBackup}
          type="button"
        >
          <Download className="h-3.5 w-3.5" /> 선택 JSON
        </button>
        <label className="btn-secondary inline-flex cursor-pointer items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs">
          <Upload className="h-3.5 w-3.5" /> JSON 가져오기
          <input
            accept="application/json,.json"
            className="sr-only"
            data-testid="smoke-failure-metadata-saved-filter-restore"
            onChange={(event) => {
              const input = event.currentTarget;
              void prepareRestoreBackup(input.files?.[0]).finally(() => {
                input.value = "";
              });
            }}
            type="file"
          />
        </label>
        <span className="text-[11px] text-gray-500 dark:text-slate-400">
          전체 또는 선택 항목 JSON을 확인한 뒤 현재 목록과 교체하거나 병합합니다.
        </span>
      </div>
      {pendingRestore ? (
        <SmokeFailureMetadataSavedFilterRestorePreview
          backup={pendingRestore.backup}
          current={savedFilters}
          filename={pendingRestore.filename}
          key={pendingRestore.key}
          onCancel={() => {
            setPendingRestore(null);
            setNotice("저장 필터 JSON 복원을 취소했습니다.");
          }}
          onRestore={restoreBackup}
        />
      ) : null}
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

function downloadJsonBackup(backup: { content: string; filename: string }): void {
  const url = URL.createObjectURL(
    new Blob([backup.content], { type: "application/json;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = backup.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
