"use client";

import { Download, Trash2 } from "lucide-react";
import { useState } from "react";

import type { SmokeFailureMetadataEntry } from "@/features/settings/api/settingsApi";
import { useCleanupSmokeFailureMetadata } from "@/features/settings/hooks/useSettings";
import { downloadSmokeFailureMetadata } from "@/features/settings/lib/smokeFailureMetadataExport";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

const FAILURE_TYPE_LABELS = {
  external_api: "외부 API",
  login: "로그인",
  visual_regression: "화면 회귀",
} as const;

interface SmokeFailureMetadataManagementProps {
  entries: SmokeFailureMetadataEntry[];
  timezone?: string;
}

export function SmokeFailureMetadataManagement({
  entries,
  timezone,
}: SmokeFailureMetadataManagementProps) {
  const cleanup = useCleanupSmokeFailureMetadata();
  const [selectedRunIds, setSelectedRunIds] = useState<Set<number>>(new Set());
  const [notice, setNotice] = useState("");
  const allSelected =
    entries.length > 0 && entries.every((entry) => selectedRunIds.has(entry.run_id));

  const toggleRun = (runId: number) => {
    setSelectedRunIds((current) => {
      const next = new Set(current);
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      return next;
    });
  };

  const handleCleanup = async () => {
    const runIds = [...selectedRunIds];
    if (
      !runIds.length ||
      !window.confirm(
        `선택한 실패 분류 정보 ${runIds.length}건을 삭제할까요? 삭제 후 복구할 수 없습니다.`,
      )
    ) {
      return;
    }
    setNotice("");
    try {
      const result = await cleanup.mutateAsync(runIds);
      setSelectedRunIds(new Set());
      setNotice(`${result.deleted_count}건을 정리했습니다.`);
    } catch {
      setNotice("선택한 실패 분류 정보를 정리하지 못했습니다.");
    }
  };

  return (
    <details
      className="mt-3 rounded-md border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
      data-testid="smoke-failure-metadata-management"
    >
      <summary className="cursor-pointer text-xs font-semibold text-gray-700 dark:text-slate-200">
        실패 분류 정보 관리 {entries.length}건
      </summary>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          className="btn-secondary inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs"
          data-testid="smoke-failure-metadata-export"
          disabled={!entries.length}
          onClick={() => downloadSmokeFailureMetadata(entries, timezone)}
          type="button"
        >
          <Download className="h-3.5 w-3.5" /> JSON 내보내기
        </button>
        <button
          className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 bg-white px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
          data-testid="smoke-failure-metadata-cleanup"
          disabled={!selectedRunIds.size || cleanup.isPending}
          onClick={() => void handleCleanup()}
          type="button"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {cleanup.isPending ? "정리 중" : `선택 정리 (${selectedRunIds.size})`}
        </button>
        <span
          aria-live="polite"
          className="text-xs text-gray-500 dark:text-slate-400"
        >
          {notice}
        </span>
      </div>
      {entries.length ? (
        <div className="mt-3 max-h-72 overflow-auto rounded-md border border-gray-200 dark:border-slate-700">
          <label className="flex cursor-pointer items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-950">
            <input
              checked={allSelected}
              onChange={() =>
                setSelectedRunIds(
                  allSelected ? new Set() : new Set(entries.map((entry) => entry.run_id)),
                )
              }
              type="checkbox"
            />
            전체 선택
          </label>
          <ol className="divide-y divide-gray-100 dark:divide-slate-800">
            {entries.map((entry) => (
              <li className="px-3 py-2" key={entry.run_id}>
                <label className="flex cursor-pointer items-start gap-2 text-xs">
                  <input
                    checked={selectedRunIds.has(entry.run_id)}
                    className="mt-0.5"
                    onChange={() => toggleRun(entry.run_id)}
                    type="checkbox"
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold text-gray-800 dark:text-slate-200">
                      실행 #{entry.run_id} · {FAILURE_TYPE_LABELS[entry.failure_type]}
                    </span>
                    <span className="block break-words text-gray-600 dark:text-slate-300">
                      {entry.check_name}
                    </span>
                    <span className="block text-gray-500 dark:text-slate-400">
                      {formatDateTime(entry.captured_at, timezone)}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">
          보관된 실패 분류 정보가 없습니다.
        </p>
      )}
    </details>
  );
}
