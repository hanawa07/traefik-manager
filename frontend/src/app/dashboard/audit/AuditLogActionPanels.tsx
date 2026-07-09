import { Loader2 } from "lucide-react";

import type { RollbackResourceType } from "./auditPageHelpers";

interface AuditRollbackPanelProps {
  logId: string;
  rollbackResourceType: RollbackResourceType;
  isRollbackPending: boolean;
  onRollback: (resourceType: RollbackResourceType, auditLogId: string) => void;
}

export function AuditRollbackPanel({
  logId,
  rollbackResourceType,
  isRollbackPending,
  onRollback,
}: AuditRollbackPanelProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/40 dark:bg-amber-950/30">
      <p className="text-sm text-amber-800 dark:text-amber-200">
        이 변경은 안전 롤백을 지원합니다. 저장된 이전 상태로 되돌립니다.
      </p>
      <button
        type="button"
        onClick={() => onRollback(rollbackResourceType, logId)}
        disabled={isRollbackPending}
        className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-100 dark:hover:bg-amber-500/25"
      >
        {isRollbackPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        이전 상태로 롤백
      </button>
    </div>
  );
}

interface AuditRetryDeliveryPanelProps {
  logId: string;
  isRetryPending: boolean;
  onRetryDelivery: (auditLogId: string) => void;
}

export function AuditRetryDeliveryPanel({
  logId,
  isRetryPending,
  onRetryDelivery,
}: AuditRetryDeliveryPanelProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-500/40 dark:bg-rose-950/30">
      <p className="text-sm text-rose-800 dark:text-rose-200">
        실패한 알림 전송입니다. 현재 채널 설정으로 다시 시도할 수 있습니다.
      </p>
      <button
        type="button"
        onClick={() => onRetryDelivery(logId)}
        disabled={isRetryPending}
        className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-900 transition hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/50 dark:bg-rose-500/15 dark:text-rose-100 dark:hover:bg-rose-500/25"
      >
        {isRetryPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        전송 재시도
      </button>
    </div>
  );
}
