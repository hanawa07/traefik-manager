"use client";

import { useEffect, useState } from "react";

import type {
  SmokeFailureCategory,
  SmokeFailureType,
  SmokeFailureTypeRun,
  SmokeRunStatistics,
} from "@/features/settings/api/settingsApi";

const EMPTY_COUNTS = {
  external_api: 0,
  login: 0,
  unclassified: 0,
  visual_regression: 0,
};

const TYPE_BARS = [
  { key: "login", label: "로그인", style: "bg-rose-500" },
  { key: "external_api", label: "외부 API", style: "bg-amber-500" },
  { key: "visual_regression", label: "화면 회귀", style: "bg-cyan-500" },
  { key: "unclassified", label: "미분류", style: "bg-slate-400" },
] as const;

interface SmokeFailureTypeTrendProps {
  statistic?: SmokeRunStatistics;
  persistFilters?: boolean;
  classifyingRunId?: number;
  classificationError?: string;
  onClassifyRun?: (run: SmokeFailureTypeRun, failureType: SmokeFailureType) => Promise<void>;
}

export function SmokeFailureTypeTrend({
  statistic,
  persistFilters = false,
  classifyingRunId,
  classificationError,
  onClassifyRun,
}: SmokeFailureTypeTrendProps) {
  const [selectedCategory, setSelectedCategory] = useState<SmokeFailureCategory | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    if (!persistFilters) return;
    const params = new URLSearchParams(window.location.search);
    const category = params.get("smoke_trend_type");
    const date = params.get("smoke_trend_date");
    if (isFailureCategory(category)) setSelectedCategory(category);
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) setSelectedDate(date);
  }, [persistFilters]);

  if (!statistic) return null;
  const counts = { ...EMPTY_COUNTS, ...statistic.failure_type_counts };
  const daily = statistic.failure_type_daily ?? [];
  const runs = statistic.failure_type_runs ?? [];
  const increaseAlerts = statistic.failure_type_increase_alerts ?? [];
  const classified = counts.login + counts.external_api + counts.visual_regression;
  const hasFilter = selectedCategory !== null || selectedDate !== null;
  const filteredRuns = runs.filter(
    (run) =>
      (!selectedCategory || run.failure_type === selectedCategory) &&
      (!selectedDate || run.occurred_on === selectedDate),
  );
  const maxDailyTypeCount = Math.max(
    1,
    ...daily.flatMap((point) => TYPE_BARS.map(({ key }) => point[key] ?? 0)),
  );

  return (
    <section
      className="mt-2 basis-full rounded-md border border-current/15 bg-white/50 px-2.5 py-2 text-[11px] dark:bg-slate-900/50"
      data-testid="smoke-failure-type-summary"
      data-window-days={statistic.window_days}
    >
      <p className="font-semibold" data-testid="smoke-failure-type-period-counts">
        최근 {statistic.window_days}일 전체 실패 유형 · 분류 {classified}/
        {statistic.failure_count}건
      </p>
      <div className="mt-1 flex flex-wrap gap-1.5" aria-label="실패 유형 실행 필터">
        {TYPE_BARS.map(({ key, label, style }) => (
          <button
            aria-pressed={selectedCategory === key}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
              selectedCategory === key
                ? "border-current bg-white shadow-sm dark:bg-slate-950"
                : "border-current/15 hover:bg-white/80 dark:hover:bg-slate-950/70"
            }`}
            data-testid={`smoke-failure-type-filter-${key}`}
            disabled={counts[key] === 0}
            key={key}
            onClick={() => {
              const next = selectedCategory === key ? null : key;
              setSelectedCategory(next);
              if (persistFilters) replaceTrendUrl("smoke_trend_type", next);
            }}
            type="button"
          >
            <span className={`h-2 w-2 rounded-sm ${style}`} aria-hidden="true" />
            {label} {counts[key]}
          </button>
        ))}
      </div>
      {increaseAlerts.length ? (
        <div
          className="mt-2 rounded bg-rose-100 px-2 py-1 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200"
          data-testid="smoke-failure-type-increase-alert"
          role="alert"
        >
          <p className="font-semibold">유형 증가 경고</p>
          {increaseAlerts.map((alert) => (
            <p key={alert.failure_type}>
              {failureCategoryLabel(alert.failure_type)} · 최근 7일 {alert.recent_count}건 ·
              직전 7일 {alert.previous_count}건
            </p>
          ))}
          <p className="opacity-75">기준: 최근 7일 2건 이상이며 직전 7일보다 증가</p>
        </div>
      ) : null}
      {daily.length ? (
        <ol
          aria-label={`최근 ${statistic.window_days}일 실패 유형 발생일 추이`}
          className="mt-2 flex min-h-12 items-end gap-1.5 overflow-x-auto pb-1"
          data-testid="smoke-failure-type-trend"
        >
          {daily.map((point) => (
            <li className="min-w-10" key={point.captured_on}>
              <button
                aria-label={`${point.captured_on} 실패 실행 필터`}
                aria-pressed={selectedDate === point.captured_on}
                className={`grid w-full justify-items-center gap-1 rounded px-1 py-0.5 ${
                  selectedDate === point.captured_on
                    ? "bg-white shadow-sm dark:bg-slate-950"
                    : "hover:bg-white/70 dark:hover:bg-slate-950/60"
                }`}
                data-testid="smoke-failure-date-filter"
                onClick={() => {
                  const next = selectedDate === point.captured_on ? null : point.captured_on;
                  setSelectedDate(next);
                  if (persistFilters) replaceTrendUrl("smoke_trend_date", next);
                }}
                title={`${point.captured_on} · 로그인 ${point.login} · 외부 API ${point.external_api} · 화면 회귀 ${point.visual_regression} · 미분류 ${point.unclassified ?? 0}`}
                type="button"
              >
                <span className="flex h-8 items-end gap-0.5" aria-hidden="true">
                  {TYPE_BARS.map(({ key, style }) => (
                    <span
                      className={`w-1.5 rounded-t-sm ${style}`}
                      key={key}
                      style={{
                        height: (point[key] ?? 0)
                          ? `${Math.max(4, Math.round(((point[key] ?? 0) / maxDailyTypeCount) * 32))}px`
                          : 0,
                      }}
                    />
                  ))}
                </span>
                <time className="tabular-nums opacity-70" dateTime={point.captured_on}>
                  {point.captured_on.slice(5).replace("-", "/")}
                </time>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 opacity-70" data-testid="smoke-failure-type-trend-empty">
          분류된 실패 발생일이 없습니다.
        </p>
      )}
      {hasFilter ? (
        <div
          className="mt-2 rounded border border-current/15 bg-white/70 p-2 dark:bg-slate-950/60"
          data-testid="smoke-failure-type-filtered-runs"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">선택 조건 실행 {filteredRuns.length}건</p>
            <button
              className="underline underline-offset-2"
              onClick={() => {
                setSelectedCategory(null);
                setSelectedDate(null);
                if (persistFilters) {
                  replaceTrendUrl("smoke_trend_type", null);
                  replaceTrendUrl("smoke_trend_date", null);
                }
              }}
              type="button"
            >
              필터 초기화
            </button>
          </div>
          {filteredRuns.length ? (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {filteredRuns.map((run) => (
                <span className="inline-flex items-center gap-1" key={run.run_id}>
                  <a
                    className="rounded-full border border-current/20 px-2 py-1 font-semibold hover:bg-white dark:hover:bg-slate-900"
                    data-failure-type={run.failure_type}
                    data-occurred-on={run.occurred_on}
                    href={run.run_url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    #{run.run_number ?? run.run_id} · {run.occurred_on} ·{" "}
                    {failureCategoryLabel(run.failure_type)}
                  </a>
                  {run.failure_type === "unclassified" && onClassifyRun ? (
                    <select
                      aria-label={`실행 #${run.run_number ?? run.run_id} 실패 유형 수동 분류`}
                      className="rounded border border-current/20 bg-white px-1.5 py-1 text-[11px] dark:bg-slate-900"
                      data-testid="smoke-failure-classification"
                      disabled={classifyingRunId === run.run_id}
                      onChange={(event) => {
                        const failureType = event.target.value as SmokeFailureType;
                        if (failureType) void onClassifyRun(run, failureType);
                      }}
                      value=""
                    >
                      <option value="">
                        {classifyingRunId === run.run_id ? "분류 중" : "수동 분류"}
                      </option>
                      <option value="login">로그인</option>
                      <option value="external_api">외부 API</option>
                      <option value="visual_regression">화면 회귀</option>
                    </select>
                  ) : null}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1 opacity-70">두 조건에 모두 맞는 실행이 없습니다.</p>
          )}
          {classificationError ? (
            <p className="mt-1 text-rose-700 dark:text-rose-300" role="alert">
              {classificationError}
            </p>
          ) : null}
        </div>
      ) : null}
      <p className="mt-1 opacity-70">
        전체 실패 수는 GitHub 기준이며, 미분류는 보관된 실패 정보가 없는 실행입니다.
      </p>
    </section>
  );
}

function failureCategoryLabel(category: SmokeFailureCategory): string {
  return TYPE_BARS.find(({ key }) => key === category)?.label ?? category;
}

function isFailureCategory(value: string | null): value is SmokeFailureCategory {
  return TYPE_BARS.some(({ key }) => key === value);
}

function replaceTrendUrl(
  key: "smoke_trend_type" | "smoke_trend_date",
  value: string | null,
): void {
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(key, value);
  else url.searchParams.delete(key);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}
