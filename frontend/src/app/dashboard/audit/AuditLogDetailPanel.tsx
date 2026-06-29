import { Loader2 } from "lucide-react";

import {
  formatAuditValue,
  type RollbackResourceType,
  type getAuditDiffRows,
  type getDeliveryDetailRows,
} from "./auditPageHelpers";

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
      {diffRows.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {diffRows.map((row) => (
              <span
                key={`${logId}-${row.key}`}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600"
              >
                {row.key}
              </span>
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">이전 값</p>
              <div className="space-y-2">
                {diffRows.map((row) => (
                  <div key={`${logId}-${row.key}-before`} className="grid grid-cols-[160px_1fr] gap-3 text-sm">
                    <span className="text-slate-500">{row.key}</span>
                    <span className="break-all text-slate-900">{formatAuditValue(row.before)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">이후 값</p>
              <div className="space-y-2">
                {diffRows.map((row) => (
                  <div key={`${logId}-${row.key}-after`} className="grid grid-cols-[160px_1fr] gap-3 text-sm">
                    <span className="text-slate-500">{row.key}</span>
                    <span className="break-all text-slate-900">{formatAuditValue(row.after)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : null}
      {deliveryRows.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">전송 상세</p>
          <div className="space-y-2">
            {deliveryRows.map((row) => (
              <div key={`${logId}-${row.key}-delivery`} className="grid grid-cols-[160px_1fr] gap-3 text-sm">
                <span className="text-slate-500">{row.label}</span>
                <span className="break-all text-slate-900">{formatAuditValue(row.value)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {rollbackSupported && rollbackResourceType ? (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">
            이 변경은 안전 롤백을 지원합니다. 저장된 이전 상태로 되돌립니다.
          </p>
          <button
            type="button"
            onClick={() => onRollback(rollbackResourceType, logId)}
            disabled={isRollbackPending}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRollbackPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            이전 상태로 롤백
          </button>
        </div>
      ) : null}
      {retrySupported ? (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <p className="text-sm text-rose-800">
            실패한 알림 전송입니다. 현재 채널 설정으로 다시 시도할 수 있습니다.
          </p>
          <button
            type="button"
            onClick={() => onRetryDelivery(logId)}
            disabled={isRetryPending}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-900 transition hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRetryPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            전송 재시도
          </button>
        </div>
      ) : null}
    </div>
  );
}
