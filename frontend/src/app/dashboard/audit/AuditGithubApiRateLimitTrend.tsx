"use client";

import { ShieldAlert } from "lucide-react";

import { useAuditPage } from "@/features/audit/hooks/useAudit";

import type { AuditPeriodDays } from "./auditPageHelpers";

interface AuditGithubApiRateLimitTrendProps {
  selectedPeriod: AuditPeriodDays;
  onSelectPeriod: (period: 1 | 7 | 30) => void;
}

export function AuditGithubApiRateLimitTrend({
  selectedPeriod,
  onSelectPeriod,
}: AuditGithubApiRateLimitTrendProps) {
  const primaryDay = useAuditPage(rateLimitQuery("github_api_primary_rate_limit", 1));
  const secondaryDay = useAuditPage(rateLimitQuery("github_api_secondary_rate_limit", 1));
  const primaryWeek = useAuditPage(rateLimitQuery("github_api_primary_rate_limit", 7));
  const secondaryWeek = useAuditPage(rateLimitQuery("github_api_secondary_rate_limit", 7));
  const primaryMonth = useAuditPage(rateLimitQuery("github_api_primary_rate_limit", 30));
  const secondaryMonth = useAuditPage(rateLimitQuery("github_api_secondary_rate_limit", 30));
  const periods = [
    rateLimitPeriod(1, "24시간", primaryDay.data?.total, secondaryDay.data?.total),
    rateLimitPeriod(7, "7일", primaryWeek.data?.total, secondaryWeek.data?.total),
    rateLimitPeriod(30, "30일", primaryMonth.data?.total, secondaryMonth.data?.total),
  ];
  const maxTotal = Math.max(1, ...periods.map((period) => period.total ?? 0));

  return (
    <section
      className="mb-5 overflow-hidden rounded-2xl border border-cyan-200 bg-gradient-to-r from-cyan-50 via-white to-amber-50 p-5 shadow-sm dark:border-cyan-500/20 dark:from-cyan-950/30 dark:via-slate-950 dark:to-amber-950/20"
      data-testid="audit-github-api-rate-limit-trend"
    >
      <div className="mb-4 flex items-start gap-3">
        <span className="rounded-xl bg-cyan-100 p-2 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300">
          <ShieldAlert aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">GitHub API 제한 추이</h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            기본 요청 한도와 보조 요청 제한 발생 건수를 기간별로 비교합니다.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {periods.map((period) => (
          <button
            key={period.days}
            aria-label={`${period.label} GitHub API 제한 필터 적용`}
            aria-pressed={selectedPeriod === period.days}
            className={`rounded-xl border bg-white/80 p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:bg-slate-900/70 ${
              selectedPeriod === period.days
                ? "border-cyan-500 ring-2 ring-cyan-200 dark:border-cyan-400 dark:ring-cyan-500/20"
                : "border-white/80 hover:border-cyan-300 dark:border-slate-800 dark:hover:border-cyan-500/50"
            }`}
            data-period-days={period.days}
            data-primary={period.primary ?? ""}
            data-secondary={period.secondary ?? ""}
            data-total={period.total ?? ""}
            onClick={() => onSelectPeriod(period.days)}
            type="button"
          >
            <div className="flex items-end justify-between gap-3">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {period.label}
              </span>
              <strong className="text-xl text-slate-950 dark:text-white">
                {period.total === undefined ? "-" : `${period.total}건`}
              </strong>
            </div>
            <div className="mt-3 grid grid-cols-[2.5rem_1fr_auto] items-center gap-2 text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">기본</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <span
                  className="block h-full rounded-full bg-cyan-500"
                  style={{ width: `${((period.primary ?? 0) / maxTotal) * 100}%` }}
                />
              </span>
              <span className="font-semibold text-cyan-700 dark:text-cyan-300">
                {period.primary ?? "-"}
              </span>
              <span className="text-slate-500 dark:text-slate-400">보조</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <span
                  className="block h-full rounded-full bg-amber-500"
                  style={{ width: `${((period.secondary ?? 0) / maxTotal) * 100}%` }}
                />
              </span>
              <span className="font-semibold text-amber-700 dark:text-amber-300">
                {period.secondary ?? "-"}
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function rateLimitQuery(
  event: "github_api_primary_rate_limit" | "github_api_secondary_rate_limit",
  periodDays: 1 | 7 | 30,
) {
  return { event, limit: 1, offset: 0, period_days: periodDays } as const;
}

function rateLimitPeriod(
  days: 1 | 7 | 30,
  label: string,
  primary?: number,
  secondary?: number,
) {
  return {
    days,
    label,
    primary,
    secondary,
    total: primary === undefined || secondary === undefined ? undefined : primary + secondary,
  };
}
