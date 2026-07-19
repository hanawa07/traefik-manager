import { ArrowRight } from "lucide-react";

import { getAuditRetryDelayChange } from "@/features/audit/lib/auditRetryDelayChange";

import type { getAuditDiffRows } from "./auditPageHelpers";

interface AuditRetryDelayChangeProps {
  diffRows: ReturnType<typeof getAuditDiffRows>;
}

export function AuditRetryDelayChange({ diffRows }: AuditRetryDelayChangeProps) {
  const change = getAuditRetryDelayChange(diffRows);
  if (!change) return null;

  return (
    <section
      className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10"
      data-after-minutes={change.afterMinutes}
      data-before-minutes={change.beforeMinutes}
      data-change-direction={change.direction}
      data-testid="audit-retry-delay-change"
    >
      <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
        자동 재시도 지연 임계치
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <strong className="text-slate-900 dark:text-slate-100">{change.beforeMinutes}분</strong>
        <ArrowRight aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-300" />
        <strong className="text-slate-900 dark:text-slate-100">{change.afterMinutes}분</strong>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-slate-950/60 dark:text-amber-200">
          {Math.abs(change.deltaMinutes)}분 {change.direction === "up" ? "상향" : "하향"}
        </span>
      </div>
    </section>
  );
}
