"use client";

import { useAudit } from "@/features/audit/hooks/useAudit";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

export function AuditBulkOperationPanel({
  operationId,
  timezone,
}: {
  operationId: string;
  timezone?: string;
}) {
  const query = useAudit({ bulk_operation_id: operationId, limit: 100 });
  if (query.isLoading) {
    return <p className="text-xs text-slate-500 dark:text-slate-400">일괄 변경 기록 확인 중...</p>;
  }
  if (query.isError) {
    return <p className="text-xs text-rose-700 dark:text-rose-300">일괄 변경 기록을 불러오지 못했습니다.</p>;
  }

  const logs = query.data ?? [];
  return (
    <section
      className="rounded-xl border border-cyan-200 bg-cyan-50/70 p-4 dark:border-cyan-500/30 dark:bg-cyan-950/20"
      data-bulk-operation-id={operationId}
      data-testid="audit-bulk-operation"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-cyan-800 dark:text-cyan-200">
          서비스 운영 상태 일괄 변경 · {logs.length}건
        </p>
        <code className="break-all text-[10px] text-cyan-700 dark:text-cyan-300">{operationId}</code>
      </div>
      <ul className="space-y-2">
        {logs.map((log) => {
          const before = getRoutingMode(log.detail?.before);
          const after = getRoutingMode(log.detail?.after);
          return (
            <li
              className="flex flex-wrap items-center gap-2 rounded-lg border border-cyan-100 bg-white/80 px-3 py-2 text-xs text-slate-700 dark:border-cyan-500/20 dark:bg-slate-900/70 dark:text-slate-200"
              key={log.id}
            >
              <strong>{log.resource_name}</strong>
              {before || after ? (
                <span>{getRoutingModeLabel(before)} -&gt; {getRoutingModeLabel(after)}</span>
              ) : null}
              <time className="ml-auto text-slate-500 dark:text-slate-400" dateTime={log.created_at}>
                {formatDateTime(log.created_at, timezone)}
              </time>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function getRoutingMode(value: unknown) {
  if (!value || typeof value !== "object" || !("routing_mode" in value)) return null;
  const routingMode = value.routing_mode;
  return typeof routingMode === "string" ? routingMode : null;
}

function getRoutingModeLabel(value: string | null) {
  if (value === "active") return "정상 운영";
  if (value === "disabled") return "라우팅 비활성";
  if (value === "maintenance") return "점검 안내";
  return value ?? "-";
}
