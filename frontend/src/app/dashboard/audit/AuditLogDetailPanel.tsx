import {
  type RollbackResourceType,
  type getAuditDiffRows,
  type getDeliveryDetailRows,
  type getManagerHttpErrorDetailRows,
} from "./auditPageHelpers";
import { AuditDetailList } from "./AuditDetailList";
import { AuditDiffDetails } from "./AuditDiffDetails";
import { AuditRetryDeliveryPanel, AuditRollbackPanel } from "./AuditLogActionPanels";

type AuditDiffRows = ReturnType<typeof getAuditDiffRows>;
type AuditDeliveryRows = ReturnType<typeof getDeliveryDetailRows>;
type AuditManagerHttpRows = ReturnType<typeof getManagerHttpErrorDetailRows>;

interface AuditLogDetailPanelProps {
  logId: string;
  diffRows: AuditDiffRows;
  deliveryRows: AuditDeliveryRows;
  managerHttpRows: AuditManagerHttpRows;
  rollbackSupported: boolean;
  rollbackResourceType: RollbackResourceType | null;
  retrySupported: boolean;
  isRollbackPending: boolean;
  isRetryPending: boolean;
  onRollback: (resourceType: RollbackResourceType, auditLogId: string) => void;
  onRetryDelivery: (auditLogId: string) => void;
}

export function AuditLogDetailPanel({
  logId,
  diffRows,
  deliveryRows,
  managerHttpRows,
  rollbackSupported,
  rollbackResourceType,
  retrySupported,
  isRollbackPending,
  isRetryPending,
  onRollback,
  onRetryDelivery,
}: AuditLogDetailPanelProps) {
  return (
    <div className="space-y-4">
      <AuditDetailList
        logId={logId}
        rows={managerHttpRows}
        testId="manager-http-audit-detail"
        title="Manager API 상세"
      />
      <AuditDiffDetails logId={logId} diffRows={diffRows} />
      <AuditDetailList logId={logId} rows={deliveryRows} title="전송 상세" />
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
