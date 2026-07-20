import {
  type RollbackResourceType,
  type getAuditDiffRows,
  type getDeliveryDetailRows,
  type getManagerHttpErrorDetailRows,
  type getSmokeRotationDetailRows,
} from "./auditPageHelpers";
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
  sourceTraefikRequestId: string | null;
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
  sourceTraefikRequestId,
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
      {sourceTraefikRequestId ? (
        <section
          className="rounded-xl border border-cyan-200 bg-cyan-50/70 p-4 dark:border-cyan-500/30 dark:bg-cyan-500/10"
          data-traefik-update-source={sourceTraefikRequestId}
        >
          <p className="text-xs font-bold text-cyan-900 dark:text-cyan-100">Traefik 원본 업데이트</p>
          <code className="mt-1 block break-all text-[11px] text-cyan-800 dark:text-cyan-200">
            {sourceTraefikRequestId}
          </code>
          <a
            className="mt-2 inline-flex text-xs font-semibold text-cyan-700 underline underline-offset-2 dark:text-cyan-200"
            href={`/dashboard?traefik_update_actor=${encodeURIComponent(sourceTraefikRequestId)}#traefik-update-history`}
          >
            원본 업데이트 이력 보기
          </a>
        </section>
      ) : null}
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
