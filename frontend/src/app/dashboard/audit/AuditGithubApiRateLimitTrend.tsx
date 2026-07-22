"use client";

import { ShieldAlert } from "lucide-react";

import { useAuditPage } from "@/features/audit/hooks/useAudit";

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
  const primaryDay = useAuditPage(rateLimitQuery("github_api_primary_rate_limit", 1));
  const secondaryDay = useAuditPage(rateLimitQuery("github_api_secondary_rate_limit", 1));
  const primaryWeek = useAuditPage(rateLimitQuery("github_api_primary_rate_limit", 7));
  const secondaryWeek = useAuditPage(rateLimitQuery("github_api_secondary_rate_limit", 7));
  const primaryMonth = useAuditPage(rateLimitQuery("github_api_primary_rate_limit", 30));
  const secondaryMonth = useAuditPage(rateLimitQuery("github_api_secondary_rate_limit", 30));
  const primaryQuarter = useAuditPage(rateLimitQuery("github_api_primary_rate_limit", 90));
  const secondaryQuarter = useAuditPage(rateLimitQuery("github_api_secondary_rate_limit", 90));
  const hasCustomRange = Boolean(startDate || endDate);
  const primaryCustom = useAuditPage(
    rateLimitDateQuery("github_api_primary_rate_limit", startDate, endDate),
    hasCustomRange,
  );
  const secondaryCustom = useAuditPage(
    rateLimitDateQuery("github_api_secondary_rate_limit", startDate, endDate),
    hasCustomRange,
  );
  const periods = [
    rateLimitPeriod(1, "24시간", primaryDay.data?.total, secondaryDay.data?.total),
    rateLimitPeriod(7, "7일", primaryWeek.data?.total, secondaryWeek.data?.total),
    rateLimitPeriod(30, "30일", primaryMonth.data?.total, secondaryMonth.data?.total),
    rateLimitPeriod(90, "90일", primaryQuarter.data?.total, secondaryQuarter.data?.total),
  ];
  const customTotal =
    primaryCustom.data && secondaryCustom.data
      ? primaryCustom.data.total + secondaryCustom.data.total
      : undefined;
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
          data-loading={primaryCustom.isFetching || secondaryCustom.isFetching}
          data-primary={primaryCustom.data?.total ?? ""}
          data-secondary={secondaryCustom.data?.total ?? ""}
          data-start-date={startDate}
          data-testid="audit-github-api-rate-limit-custom-range"
          data-total={customTotal ?? ""}
        >
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            사용자 지정 · {startDate || "처음"} ~ {endDate || "현재"}
          </span>
          <span className="text-slate-600 dark:text-slate-300">
            전체 <strong className="text-slate-950 dark:text-white">{customTotal ?? "-"}건</strong>
            {" · "}기본 <strong className="text-cyan-700 dark:text-cyan-300">{primaryCustom.data?.total ?? "-"}</strong>
            {" · "}보조 <strong className="text-amber-700 dark:text-amber-300">{secondaryCustom.data?.total ?? "-"}</strong>
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

function rateLimitQuery(
  event: "github_api_primary_rate_limit" | "github_api_secondary_rate_limit",
  periodDays: 1 | 7 | 30 | 90,
) {
  return { event, limit: 1, offset: 0, period_days: periodDays } as const;
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

function rateLimitDateQuery(
  event: "github_api_primary_rate_limit" | "github_api_secondary_rate_limit",
  startDate: string,
  endDate: string,
) {
  return {
    event,
    limit: 1,
    offset: 0,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
  } as const;
}
