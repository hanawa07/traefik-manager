import { ChevronLeft, ChevronRight } from "lucide-react";

interface AuditLogPaginationProps {
  currentPage: number;
  isRefreshing: boolean;
  onPageChange: (page: number) => void;
  pageSize: number;
  totalCount: number;
}

export function AuditLogPagination({
  currentPage,
  isRefreshing,
  onPageChange,
  pageSize,
  totalCount,
}: AuditLogPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const firstItem = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(currentPage * pageSize, totalCount);

  return (
    <nav
      aria-label="감사 로그 페이지"
      className="flex flex-col gap-2 border-t border-slate-200 px-4 py-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:text-slate-300"
      data-audit-page={currentPage}
      data-audit-total={totalCount}
    >
      <span aria-live="polite">
        총 <strong className="text-slate-900 dark:text-slate-100">{totalCount.toLocaleString()}건</strong>
        {totalCount > 0 ? ` · ${firstItem.toLocaleString()}-${lastItem.toLocaleString()}건 표시` : ""}
      </span>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <button
          aria-label="이전 감사 로그 페이지"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-blue-500 dark:hover:text-blue-200"
          disabled={currentPage <= 1 || isRefreshing}
          onClick={() => onPageChange(currentPage - 1)}
          type="button"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          이전
        </button>
        <span className="min-w-20 text-center font-semibold">
          {currentPage} / {totalPages}
        </span>
        <button
          aria-label="다음 감사 로그 페이지"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-blue-500 dark:hover:text-blue-200"
          disabled={currentPage >= totalPages || isRefreshing}
          onClick={() => onPageChange(currentPage + 1)}
          type="button"
        >
          다음
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </nav>
  );
}
