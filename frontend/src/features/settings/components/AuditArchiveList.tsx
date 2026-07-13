import { Download, RotateCcw } from "lucide-react";

import type { AuditArchiveItem } from "@/features/settings/api/settingsApi";
import { getAuditArchiveDownloadUrl } from "@/features/settings/api/settingsAuditRetentionApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import { formatBytes } from "@/shared/lib/formatBytes";

interface AuditArchiveListProps {
  archives?: AuditArchiveItem[];
  isLoading: boolean;
  isError: boolean;
  restoringFilename: string | null;
  timezone?: string;
  onRestore: (filename: string) => void;
}

export function AuditArchiveList({
  archives,
  isLoading,
  isError,
  restoringFilename,
  timezone,
  onRestore,
}: AuditArchiveListProps) {
  return (
    <div className="mt-5 border-t border-gray-200 pt-4 dark:border-slate-700" data-testid="audit-archive-list">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-100">아카이브 파일</h4>
      <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
        파일을 내려받거나 복원할 수 있습니다. 같은 ID의 감사 로그는 덮어쓰지 않고 건너뜁니다.
      </p>
      {isLoading ? (
        <div className="mt-3 h-14 animate-pulse rounded-lg bg-gray-100 dark:bg-slate-800" />
      ) : isError ? (
        <p className="mt-3 text-sm text-rose-600 dark:text-rose-300">아카이브 목록을 불러오지 못했습니다.</p>
      ) : !archives?.length ? (
        <p className="mt-3 rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-500 dark:bg-slate-900 dark:text-slate-400">
          저장된 아카이브 파일이 없습니다.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {archives.map((archive) => (
            <div
              className="rounded-lg border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
              key={archive.filename}
            >
              <code className="block break-all text-xs text-gray-800 dark:text-slate-200">
                {archive.filename}
              </code>
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                {formatBytes(archive.size_bytes)} · {formatDateTime(archive.modified_at, timezone)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  className="btn-secondary inline-flex items-center gap-1.5 text-xs"
                  href={getAuditArchiveDownloadUrl(archive.filename)}
                >
                  <Download className="h-3.5 w-3.5" />
                  다운로드
                </a>
                <button
                  className="btn-secondary inline-flex items-center gap-1.5 text-xs"
                  disabled={restoringFilename !== null}
                  onClick={() => onRestore(archive.filename)}
                  type="button"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {restoringFilename === archive.filename ? "복원 중" : "복원"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
