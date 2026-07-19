"use client";

import { Clock3 } from "lucide-react";

import { useAuditPage } from "@/features/audit/hooks/useAudit";

export function AuditDelayedRetryTrend() {
  const lastDay = useAuditPage(delayedRetryQuery(1));
  const lastWeek = useAuditPage(delayedRetryQuery(7));
  const lastMonth = useAuditPage(delayedRetryQuery(30));
  const periods = [
    { days: 1, label: "24시간", total: lastDay.data?.total },
    { days: 7, label: "7일", total: lastWeek.data?.total },
    { days: 30, label: "30일", total: lastMonth.data?.total },
  ];
  const maxTotal = Math.max(1, ...periods.map((period) => period.total ?? 0));

  return (
    <section
      className="mb-5 overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-orange-50 p-5 shadow-sm dark:border-amber-500/20 dark:from-amber-950/30 dark:via-slate-950 dark:to-orange-950/20"
      data-testid="audit-delayed-retry-trend"
    >
      <div className="mb-4 flex items-start gap-3">
        <span className="rounded-xl bg-amber-100 p-2 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          <Clock3 aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">지연 재시도 추이</h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            설정된 임계치를 초과한 자동 재시도의 누적 건수입니다.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {periods.map((period) => (
          <div
            key={period.days}
            className="rounded-xl border border-white/80 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-900/70"
            data-period-days={period.days}
            data-total={period.total ?? ""}
          >
            <div className="flex items-end justify-between gap-3">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {period.label}
              </span>
              <strong className="text-xl text-slate-950 dark:text-white">
                {period.total === undefined ? "-" : `${period.total}건`}
              </strong>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
                style={{ width: `${((period.total ?? 0) / maxTotal) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function delayedRetryQuery(periodDays: 1 | 7 | 30) {
  return {
    limit: 1,
    offset: 0,
    period_days: periodDays,
    retry_delay: "delayed" as const,
  };
}
