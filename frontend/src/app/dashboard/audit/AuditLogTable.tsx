import type { AuditLogItem } from "@/features/audit/api/auditApi";

import { AuditLogEmptyRow } from "./AuditLogEmptyRow";
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
  onExpandedLogChange: (logId: string | null) => void;
  onRollback: (resourceType: RollbackResourceType, auditLogId: string) => void;
  onRetryDelivery: (auditLogId: string) => void;
}

export function AuditLogTable({
  logs,
  timezone,
  expandedLogId,
  rollbackTargetId,
  retryTargetId,
  isRollbackPending,
  isRetryPending,
  onExpandedLogChange,
  onRollback,
  onRetryDelivery,
}: AuditLogTableProps) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none"
      data-visual-surface
    >
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
    </div>
  );
}
