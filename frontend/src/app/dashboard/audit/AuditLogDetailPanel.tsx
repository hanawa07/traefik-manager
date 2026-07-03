import {
  type RollbackResourceType,
  type getAuditDiffRows,
  type getDeliveryDetailRows,
} from "./auditPageHelpers";
import { AuditDeliveryDetails } from "./AuditDeliveryDetails";
import { AuditDiffDetails } from "./AuditDiffDetails";
import { AuditRetryDeliveryPanel, AuditRollbackPanel } from "./AuditLogActionPanels";

type AuditDiffRows = ReturnType<typeof getAuditDiffRows>;
type AuditDeliveryRows = ReturnType<typeof getDeliveryDetailRows>;

interface AuditLogDetailPanelProps {
  logId: string;
  diffRows: AuditDiffRows;
  deliveryRows: AuditDeliveryRows;
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
      <AuditDiffDetails logId={logId} diffRows={diffRows} />
      <AuditDeliveryDetails logId={logId} deliveryRows={deliveryRows} />
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
