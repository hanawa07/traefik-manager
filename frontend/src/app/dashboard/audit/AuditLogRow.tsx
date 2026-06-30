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

export function AuditLogRow({
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
  const rollbackSupported =
    detail?.rollback_supported === true && log.action === "update" && rollbackResourceType !== null;

  return (
    <Fragment>
      <tr className="group transition-colors hover:bg-slate-50">
        <td className="px-6 py-4">
          <AuditActorCell actor={log.actor} />
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
            <span className="text-sm font-medium text-slate-900">
              {resource?.label || log.resource_type}
            </span>
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
          <span className="text-sm font-medium text-slate-700">
            {formatDateTime(log.created_at, timezone)}
          </span>
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

function AuditActorCell({ actor }: { actor: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-100">
        <span className="text-xs font-black text-slate-700">{actor.charAt(0).toUpperCase()}</span>
      </div>
      <span className="text-sm font-semibold text-slate-900">{actor}</span>
    </div>
  );
}
