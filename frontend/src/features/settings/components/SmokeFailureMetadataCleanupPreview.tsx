"use client";

import { AlertTriangle, Trash2 } from "lucide-react";

import type { SmokeFailureMetadataEntry } from "@/features/settings/api/settingsApi";
import { SMOKE_FAILURE_TYPE_LABELS } from "@/features/settings/lib/smokeFailureMetadataLabels";
import { githubActionsRunUrl } from "@/features/settings/lib/smokeGithubUrls";
import Modal from "@/shared/components/Modal";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

interface SmokeFailureMetadataCleanupPreviewProps {
  entries: SmokeFailureMetadataEntry[];
  hiddenSelectedCount: number;
  isOpen: boolean;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  timezone?: string;
  workflowUrl: string;
}

export function SmokeFailureMetadataCleanupPreview({
  entries,
  hiddenSelectedCount,
  isOpen,
  isPending,
  onCancel,
  onConfirm,
  timezone,
  workflowUrl,
}: SmokeFailureMetadataCleanupPreviewProps) {
  const close = () => {
    if (!isPending) onCancel();
  };

  return (
    <Modal
      isOpen={isOpen}
      maxWidthClass="max-w-2xl"
      onClose={close}
      title="실패 분류 정보 삭제 미리보기"
    >
      <div data-testid="smoke-failure-metadata-cleanup-preview">
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            선택한 {entries.length}건을 영구 삭제합니다. 삭제 후에는 복구할 수 없습니다.
          </p>
        </div>
        <p
          className="mt-3 text-xs text-gray-600 dark:text-slate-300"
          data-hidden-count={hiddenSelectedCount}
          data-selected-count={entries.length}
          data-testid="smoke-failure-metadata-cleanup-preview-summary"
        >
          삭제 대상 {entries.length}건
          {hiddenSelectedCount
            ? ` · 현재 필터 밖에서 선택한 항목 ${hiddenSelectedCount}건 포함`
            : " · 모두 현재 필터에 표시됨"}
        </p>
        <ol className="mt-2 max-h-72 divide-y divide-gray-100 overflow-auto rounded-lg border border-gray-200 dark:divide-slate-800 dark:border-slate-700">
          {entries.map((entry) => (
            <li className="px-3 py-2.5 text-xs" key={entry.run_id}>
              <p className="font-semibold text-gray-800 dark:text-slate-200">
                <a
                  className="text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-300"
                  href={githubActionsRunUrl(workflowUrl, entry.run_id)}
                  rel="noreferrer"
                  target="_blank"
                >
                  실행 #{entry.run_id}
                </a>
                {` · ${SMOKE_FAILURE_TYPE_LABELS[entry.failure_type]}`}
              </p>
              <p className="mt-0.5 break-words text-gray-600 dark:text-slate-300">
                {entry.check_name}
              </p>
              <p className="mt-0.5 text-gray-500 dark:text-slate-400">
                {formatDateTime(entry.captured_at, timezone)}
              </p>
            </li>
          ))}
        </ol>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            className="btn-secondary px-3 py-2 text-sm"
            data-testid="smoke-failure-metadata-cleanup-preview-cancel"
            disabled={isPending}
            onClick={onCancel}
            type="button"
          >
            취소
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="smoke-failure-metadata-cleanup-preview-confirm"
            disabled={!entries.length || isPending}
            onClick={onConfirm}
            type="button"
          >
            <Trash2 className="h-4 w-4" />
            {isPending ? "삭제 중" : `${entries.length}건 삭제`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
