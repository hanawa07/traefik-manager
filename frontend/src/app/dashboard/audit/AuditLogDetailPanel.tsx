import {
  type RollbackResourceType,
  type getAuditDiffRows,
  type getDeliveryDetailRows,
  type getManagerHttpErrorDetailRows,
  type getSmokeRotationDetailRows,
} from "./auditPageHelpers";
import { AuditBulkOperationPanel } from "./AuditBulkOperationPanel";
import { AuditDetailList } from "./AuditDetailList";
import { AuditDiffDetails } from "./AuditDiffDetails";
import { AuditRetryDeliveryPanel, AuditRollbackPanel } from "./AuditLogActionPanels";
import { AuditRetryChainPanel } from "./AuditRetryChainPanel";
import { AuditSecuritySettingChanges } from "./AuditSecuritySettingChanges";

type AuditDiffRows = ReturnType<typeof getAuditDiffRows>;
type AuditDeliveryRows = ReturnType<typeof getDeliveryDetailRows>;
type AuditManagerDetailRows = ReturnType<typeof getManagerHttpErrorDetailRows>;
type SmokeRotationDetailRows = ReturnType<typeof getSmokeRotationDetailRows>;

interface AuditLogDetailPanelProps {
  logId: string;
  event: unknown;
  diffRows: AuditDiffRows;
  deliveryRows: AuditDeliveryRows;
  managerDetailRows: AuditManagerDetailRows;
  smokeRotationDetailRows: SmokeRotationDetailRows;
  bulkOperationId: string | null;
  rollbackSupported: boolean;
  rollbackResourceType: RollbackResourceType | null;
  retryChainSupported: boolean;
  retrySupported: boolean;
  timezone?: string;
  isRollbackPending: boolean;
  isRetryPending: boolean;
  onRollback: (resourceType: RollbackResourceType, auditLogId: string) => void;
  onRetryDelivery: (auditLogId: string) => void;
}

export function AuditLogDetailPanel({
  logId,
  event,
  diffRows,
  deliveryRows,
  managerDetailRows,
  smokeRotationDetailRows,
  bulkOperationId,
  rollbackSupported,
  rollbackResourceType,
  retryChainSupported,
  retrySupported,
  timezone,
  isRollbackPending,
  isRetryPending,
  onRollback,
  onRetryDelivery,
}: AuditLogDetailPanelProps) {
  return (
    <div className="space-y-4">
      <AuditDetailList
        logId={logId}
        rows={managerDetailRows}
        testId="manager-audit-detail"
        title="Manager 운영 상세"
      />
      <AuditDetailList
        logId={logId}
        rows={smokeRotationDetailRows}
        testId="smoke-rotation-audit-detail"
        title="Secret 회전 상세"
      />
      <AuditSecuritySettingChanges event={event} diffRows={diffRows} />
      {bulkOperationId ? (
        <AuditBulkOperationPanel operationId={bulkOperationId} timezone={timezone} />
      ) : null}
      <AuditDiffDetails logId={logId} diffRows={diffRows} />
      <AuditDetailList logId={logId} rows={deliveryRows} title="전송 상세" />
      <AuditRetryChainPanel enabled={retryChainSupported} logId={logId} timezone={timezone} />
      {rollbackSupported && rollbackResourceType ? (
        <AuditRollbackPanel
          logId={logId}
          rollbackResourceType={rollbackResourceType}
          isRollbackPending={isRollbackPending}
          onRollback={onRollback}
        />
      ) : null}
      {retrySupported ? (
        <AuditRetryDeliveryPanel
          logId={logId}
          isRetryPending={isRetryPending}
          onRetryDelivery={onRetryDelivery}
        />
      ) : null}
    </div>
  );
}
