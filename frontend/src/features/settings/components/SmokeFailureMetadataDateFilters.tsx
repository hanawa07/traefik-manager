"use client";

import {
  buildSmokeFailureMetadataDatePresetRange,
  type SmokeFailureMetadataDatePreset,
  type SmokeFailureMetadataPeriodFilter,
} from "@/features/settings/lib/smokeFailureMetadataFilters";

const DATE_PRESETS: ReadonlyArray<{
  label: string;
  value: SmokeFailureMetadataDatePreset;
}> = [
  { label: "오늘", value: "today" },
  { label: "어제", value: "yesterday" },
  { label: "이번 달", value: "this_month" },
  { label: "지난달", value: "last_month" },
];

interface SmokeFailureMetadataDateFiltersProps {
  endDate: string;
  onEndDateChange: (value: string) => void;
  onRangeChange: (startDate: string, endDate: string) => void;
  onStartDateChange: (value: string) => void;
  period: SmokeFailureMetadataPeriodFilter;
  startDate: string;
  timezone?: string;
}

export function SmokeFailureMetadataDateFilters({
  endDate,
  onEndDateChange,
  onRangeChange,
  onStartDateChange,
  period,
  startDate,
  timezone,
}: SmokeFailureMetadataDateFiltersProps) {
  const invalidDateRange = Boolean(
    period === "custom" && startDate && endDate && startDate > endDate,
  );

  return (
    <>
      <div
        aria-label="실패 분류 정보 빠른 기간"
        className="mt-2 flex flex-wrap items-center gap-1.5"
        role="group"
      >
        <span className="mr-1 text-[11px] font-medium text-gray-500 dark:text-slate-400">
          빠른 기간
        </span>
        {DATE_PRESETS.map(({ label, value }) => {
          const range = buildSmokeFailureMetadataDatePresetRange(value, { timezone });
          const active =
            period === "custom" &&
            range.startDate === startDate &&
            range.endDate === endDate;
          return (
            <button
              aria-pressed={active}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                active
                  ? "border-cyan-500 bg-cyan-50 text-cyan-800 dark:border-cyan-500 dark:bg-cyan-950/50 dark:text-cyan-200"
                  : "border-gray-200 bg-white text-gray-600 hover:border-cyan-300 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-cyan-700 dark:hover:text-cyan-300"
              }`}
              data-testid={`smoke-failure-metadata-date-preset-${value}`}
              key={value}
              onClick={() => onRangeChange(range.startDate, range.endDate)}
              type="button"
            >
              {label}
            </button>
          );
        })}
      </div>
      {period === "custom" ? (
        <div
          className="mt-2 grid gap-2 sm:grid-cols-2"
          data-testid="smoke-failure-metadata-date-range"
        >
          <label className="grid gap-1 text-[11px] text-gray-500 dark:text-slate-400">
            시작일
            <input
              aria-label="실패 분류 정보 시작일"
              className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              data-testid="smoke-failure-metadata-start-date"
              max={endDate || undefined}
              onChange={(event) => onStartDateChange(event.target.value)}
              type="date"
              value={startDate}
            />
          </label>
          <label className="grid gap-1 text-[11px] text-gray-500 dark:text-slate-400">
            종료일
            <input
              aria-label="실패 분류 정보 종료일"
              className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              data-testid="smoke-failure-metadata-end-date"
              min={startDate || undefined}
              onChange={(event) => onEndDateChange(event.target.value)}
              type="date"
              value={endDate}
            />
          </label>
          <p
            className={`text-[11px] sm:col-span-2 ${
              invalidDateRange
                ? "text-rose-600 dark:text-rose-300"
                : "text-gray-500 dark:text-slate-400"
            }`}
            data-testid="smoke-failure-metadata-date-range-note"
          >
            {invalidDateRange
              ? "시작일은 종료일보다 늦을 수 없습니다."
              : `${timezone || "브라우저 시간대"} 기준 · 시작일과 종료일 포함`}
          </p>
        </div>
      ) : null}
    </>
  );
}
