import { Fragment } from "react";

import { clsx } from "clsx";

import type { AuditLogItem } from "@/features/audit/api/auditApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import { AuditLogDetailPanel } from "./AuditLogDetailPanel";
import {
  actionConfig,
  fallbackResourceIcon,
  getAuditDiffRows,
  getDeliveryDetailRows,
  isRecord,
  isRollbackResourceType,
  resourceTypeConfig,
  securityEventConfig,
  type RollbackResourceType,
} from "./auditPageHelpers";

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
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-700">사용자</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-700">이벤트</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-700">작업</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-700">대상 타입</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-700">대상 이름</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-700">발생 시각</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {!logs || logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-20 text-center text-slate-500">
                  기록된 감사 로그가 없습니다.
                </td>
              </tr>
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

interface AuditLogRowProps {
  log: AuditLogItem;
  timezone: string | undefined;
  isExpanded: boolean;
  rollbackTargetId: string | null;
  retryTargetId: string | null;
  isRollbackPending: boolean;
  isRetryPending: boolean;
  onExpandedLogChange: (logId: string | null) => void;
  onRollback: (resourceType: RollbackResourceType, auditLogId: string) => void;
  onRetryDelivery: (auditLogId: string) => void;
}

function AuditLogRow({
  log,
  timezone,
  isExpanded,
  rollbackTargetId,
  retryTargetId,
  isRollbackPending,
  isRetryPending,
  onExpandedLogChange,
  onRollback,
  onRetryDelivery,
}: AuditLogRowProps) {
  const resource = resourceTypeConfig[log.resource_type];
  const action = actionConfig[log.action];
  const event = log.event ? securityEventConfig[log.event] : null;
  const ResourceIcon = resource?.icon || fallbackResourceIcon;
  const detail = isRecord(log.detail) ? log.detail : null;
  const diffRows = getAuditDiffRows(detail);
  const deliveryRows = getDeliveryDetailRows(detail);
  const retrySupported = log.event?.endsWith("_delivery_failure") === true;
  const canExpand = diffRows.length > 0 || deliveryRows.length > 0;
  const rollbackResourceType = isRollbackResourceType(log.resource_type) ? log.resource_type : null;
  const rollbackSupported = detail?.rollback_supported === true && log.action === "update" && rollbackResourceType !== null;

  return (
    <Fragment>
      <tr className="group transition-colors hover:bg-slate-50">
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-100">
              <span className="text-xs font-black text-slate-700">{log.actor.charAt(0).toUpperCase()}</span>
            </div>
            <span className="text-sm font-semibold text-slate-900">{log.actor}</span>
          </div>
        </td>
        <td className="px-6 py-4">
          {event ? (
            <span className={clsx("rounded-md border px-2.5 py-1 text-[11px] font-black", event.color)}>
              {event.label}
            </span>
          ) : (
            <span className="text-xs text-slate-500">-</span>
          )}
        </td>
        <td className="px-6 py-4">
          <span
            className={clsx(
              "rounded-md border px-2.5 py-1 text-[11px] font-black",
              action?.color || "border-slate-200 bg-slate-100 text-slate-700",
            )}
          >
            {action?.label || log.action}
          </span>
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <div className={clsx("rounded-lg p-1.5", resource?.color)}>
              <ResourceIcon className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-medium text-slate-900">{resource?.label || log.resource_type}</span>
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="space-y-2">
            <span className="block text-sm font-bold text-slate-900 transition-colors group-hover:text-blue-600">
              {log.resource_name}
            </span>
            {canExpand ? (
              <button
                type="button"
                onClick={() => onExpandedLogChange(isExpanded ? null : log.id)}
                className="text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                {isExpanded ? "상세 숨기기" : "상세 보기"}
              </button>
            ) : null}
          </div>
        </td>
        <td className="whitespace-nowrap px-6 py-4">
          <span className="text-sm font-medium text-slate-700">{formatDateTime(log.created_at, timezone)}</span>
        </td>
      </tr>
      {isExpanded ? (
        <tr className="bg-slate-50/80">
          <td colSpan={6} className="px-6 py-5">
            <AuditLogDetailPanel
              logId={log.id}
              diffRows={diffRows}
              deliveryRows={deliveryRows}
              rollbackSupported={rollbackSupported}
              rollbackResourceType={rollbackResourceType}
              retrySupported={retrySupported}
              isRollbackPending={isRollbackPending && rollbackTargetId === log.id}
              isRetryPending={isRetryPending && retryTargetId === log.id}
              onRollback={onRollback}
              onRetryDelivery={onRetryDelivery}
            />
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}
