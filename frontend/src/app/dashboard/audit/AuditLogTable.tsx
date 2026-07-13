import { Loader2 } from "lucide-react";

import type { AuditLogItem } from "@/features/audit/api/auditApi";

import { AuditLogEmptyRow } from "./AuditLogEmptyRow";
import { AuditLogPagination } from "./AuditLogPagination";
import { AuditLogRow } from "./AuditLogRow";
import { AuditLogTableHeader } from "./AuditLogTableHeader";
import type { RollbackResourceType } from "./auditPageHelpers";

interface AuditLogTableProps {
  logs: AuditLogItem[] | undefined;
  timezone: string | undefined;
  expandedLogId: string | null;
  rollbackTargetId: string | null;
  retryTargetId: string | null;
  isRollbackPending: boolean;
  isRetryPending: boolean;
  isRefreshing: boolean;
  currentPage: number;
  pageSize: number;
  totalCount: number;
  onExpandedLogChange: (logId: string | null) => void;
  onRollback: (resourceType: RollbackResourceType, auditLogId: string) => void;
  onRetryDelivery: (auditLogId: string) => void;
  onPageChange: (page: number) => void;
}

export function AuditLogTable({
  logs,
  timezone,
  expandedLogId,
  rollbackTargetId,
  retryTargetId,
  isRollbackPending,
  isRetryPending,
  isRefreshing,
  currentPage,
  pageSize,
  totalCount,
  onExpandedLogChange,
  onRollback,
  onRetryDelivery,
  onPageChange,
}: AuditLogTableProps) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none"
      data-visual-surface
      aria-busy={isRefreshing}
    >
      {isRefreshing ? (
        <div className="flex items-center gap-2 border-b border-blue-100 bg-blue-50 px-4 py-2 text-xs font-medium text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          필터 결과 갱신 중...
        </div>
      ) : null}
      <div className="overflow-x-auto" data-table-scroll="audit-log">
        <table className="w-full min-w-[1040px] border-collapse text-left">
          <AuditLogTableHeader />
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {!logs || logs.length === 0 ? (
              <AuditLogEmptyRow />
            ) : (
              logs.map((log) => (
                <AuditLogRow
                  key={log.id}
                  log={log}
                  timezone={timezone}
                  isExpanded={expandedLogId === log.id}
                  rollbackTargetId={rollbackTargetId}
                  retryTargetId={retryTargetId}
                  isRollbackPending={isRollbackPending}
                  isRetryPending={isRetryPending}
                  onExpandedLogChange={onExpandedLogChange}
                  onRollback={onRollback}
                  onRetryDelivery={onRetryDelivery}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
      <AuditLogPagination
        currentPage={currentPage}
        isRefreshing={isRefreshing}
        onPageChange={onPageChange}
        pageSize={pageSize}
        totalCount={totalCount}
      />
    </div>
  );
}
