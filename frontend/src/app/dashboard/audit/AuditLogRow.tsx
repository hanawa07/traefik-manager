import { Fragment } from "react";

import type { AuditLogItem } from "@/features/audit/api/auditApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

import { AuditActorCell } from "./AuditActorCell";
import { AuditBadgeCell } from "./AuditBadgeCell";
import { AuditLogDetailPanel } from "./AuditLogDetailPanel";
import { AuditResourceCell } from "./AuditResourceCell";
import { AuditTargetCell } from "./AuditTargetCell";
import {
  actionConfig,
  getAuditDiffRows,
  getDeploymentBottleneckCleanupDetailRows,
  getDeliveryDetailRows,
  getManagerHttpErrorDetailRows,
  getManagerHttpLogStorageDetailRows,
  isRecord,
  isRollbackResourceType,
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
  const action = actionConfig[log.action];
  const event = log.event ? securityEventConfig[log.event] : null;
  const detail = isRecord(log.detail) ? log.detail : null;
  const diffRows = getAuditDiffRows(detail);
  const deliveryRows = getDeliveryDetailRows(detail);
  const managerEvent = log.event ?? detail?.event;
  const managerDetailRows = [
    ...getDeploymentBottleneckCleanupDetailRows(managerEvent, detail),
    ...getManagerHttpErrorDetailRows(managerEvent, detail),
    ...getManagerHttpLogStorageDetailRows(managerEvent, detail),
  ];
  const retrySupported = log.event?.endsWith("_delivery_failure") === true;
  const canExpand = diffRows.length > 0 || deliveryRows.length > 0 || managerDetailRows.length > 0;
  const rollbackResourceType = isRollbackResourceType(log.resource_type) ? log.resource_type : null;
  const rollbackSupported =
    detail?.rollback_supported === true && log.action === "update" && rollbackResourceType !== null;

  return (
    <Fragment>
      <tr
        className="group transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/70"
        data-audit-event={log.event || undefined}
        data-audit-log-id={log.id}
      >
        <td className="px-6 py-4">
          <AuditActorCell actor={log.actor} />
        </td>
        <td className="px-6 py-4">
          <AuditBadgeCell config={event} />
        </td>
        <td className="px-6 py-4">
          <AuditBadgeCell
            config={
              action || {
                label: log.action,
                color:
                  "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
              }
            }
          />
        </td>
        <td className="px-6 py-4">
          <AuditResourceCell resourceType={log.resource_type} />
        </td>
        <td className="px-6 py-4">
          <AuditTargetCell
            canExpand={canExpand}
            isExpanded={isExpanded}
            onToggleExpanded={() => onExpandedLogChange(isExpanded ? null : log.id)}
            resourceName={log.resource_name}
          />
        </td>
        <td className="whitespace-nowrap px-6 py-4">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {formatDateTime(log.created_at, timezone)}
          </span>
        </td>
      </tr>
      {isExpanded ? (
        <tr className="bg-slate-50/80 dark:bg-slate-950/70">
          <td colSpan={6} className="px-6 py-5">
            <AuditLogDetailPanel
              logId={log.id}
              diffRows={diffRows}
              deliveryRows={deliveryRows}
              managerDetailRows={managerDetailRows}
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
