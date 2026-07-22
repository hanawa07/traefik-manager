"use client";

import { ShieldAlert } from "lucide-react";

import { useAuditGithubApiRateLimitSummary } from "@/features/audit/hooks/useAudit";

import type { AuditPeriodDays } from "./auditPageHelpers";

interface AuditGithubApiRateLimitTrendProps {
  startDate: string;
  endDate: string;
  selectedPeriod: AuditPeriodDays;
  onSelectPeriod: (period: 1 | 7 | 30 | 90) => void;
}

export function AuditGithubApiRateLimitTrend({
  startDate,
  endDate,
  selectedPeriod,
  onSelectPeriod,
}: AuditGithubApiRateLimitTrendProps) {
  const summary = useAuditGithubApiRateLimitSummary(startDate, endDate);
  const periodCounts = new Map(summary.data?.periods.map((period) => [period.days, period]));
  const hasCustomRange = Boolean(startDate || endDate);
  const custom = summary.data?.custom;
  const periods = [
    rateLimitPeriod(1, "24시간", periodCounts.get(1)?.primary, periodCounts.get(1)?.secondary),
    rateLimitPeriod(7, "7일", periodCounts.get(7)?.primary, periodCounts.get(7)?.secondary),
    rateLimitPeriod(30, "30일", periodCounts.get(30)?.primary, periodCounts.get(30)?.secondary),
    rateLimitPeriod(90, "90일", periodCounts.get(90)?.primary, periodCounts.get(90)?.secondary),
  ];
  const customTotal = custom ? custom.primary + custom.secondary : undefined;
  const maxTotal = Math.max(1, customTotal ?? 0, ...periods.map((period) => period.total ?? 0));

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
            기본 요청 한도와 보조 요청 제한 발생 건수를 90일과 사용자 지정 기간까지 비교합니다.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
      {hasCustomRange ? (
        <div
          className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-200 bg-white/80 px-4 py-3 text-xs dark:border-cyan-500/30 dark:bg-slate-900/70"
          data-end-date={endDate}
          data-loading={summary.isFetching}
          data-primary={custom?.primary ?? ""}
          data-secondary={custom?.secondary ?? ""}
          data-start-date={startDate}
          data-testid="audit-github-api-rate-limit-custom-range"
          data-total={customTotal ?? ""}
        >
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            사용자 지정 · {startDate || "처음"} ~ {endDate || "현재"}
          </span>
          <span className="text-slate-600 dark:text-slate-300">
            전체 <strong className="text-slate-950 dark:text-white">{customTotal ?? "-"}건</strong>
            {" · "}기본 <strong className="text-cyan-700 dark:text-cyan-300">{custom?.primary ?? "-"}</strong>
            {" · "}보조 <strong className="text-amber-700 dark:text-amber-300">{custom?.secondary ?? "-"}</strong>
          </span>
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
          위 시작일·종료일 필터를 지정하면 같은 범위의 기본·보조 제한 합계를 함께 표시합니다.
        </p>
      )}
    </section>
  );
}

function rateLimitPeriod(
  days: 1 | 7 | 30 | 90,
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
