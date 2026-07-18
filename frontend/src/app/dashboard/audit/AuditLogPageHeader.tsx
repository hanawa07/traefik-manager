"use client";

import { Download, History } from "lucide-react";
import { useState } from "react";

import { buildAuditExportUrl, type AuditLogQueryParams } from "@/features/audit/api/auditApi";
import { useAuditPage } from "@/features/audit/hooks/useAudit";

interface AuditLogPageHeaderProps {
  exportUrl: string;
}

const ROTATION_CSV_PERIODS = [
  { label: "전체 기간", value: "all" },
  { label: "최근 7일", value: "7" },
  { label: "최근 30일", value: "30" },
  { label: "최근 90일", value: "90" },
  { label: "사용자 지정", value: "custom" },
] as const;
type RotationCsvPeriod = (typeof ROTATION_CSV_PERIODS)[number]["value"];

const EXPORT_LINK_CLASS =
  "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:shadow-none dark:hover:border-blue-500 dark:hover:text-blue-200";

export function AuditLogPageHeader({ exportUrl }: AuditLogPageHeaderProps) {
  const [rotationCsvPeriod, setRotationCsvPeriod] = useState<RotationCsvPeriod>("all");
  const [rotationStartDate, setRotationStartDate] = useState("");
  const [rotationEndDate, setRotationEndDate] = useState("");
  const isCustomRotationRange = rotationCsvPeriod === "custom";
  const isRotationRangeValid =
    !isCustomRotationRange ||
    Boolean(rotationStartDate && rotationEndDate && rotationStartDate <= rotationEndDate);
  const smokeRotationFilters: AuditLogQueryParams = {
    event: "smoke_rotation_result",
    period_days:
      rotationCsvPeriod === "all" || isCustomRotationRange
        ? undefined
        : Number(rotationCsvPeriod) as 7 | 30 | 90,
    start_date: isCustomRotationRange ? rotationStartDate || undefined : undefined,
    end_date: isCustomRotationRange ? rotationEndDate || undefined : undefined,
  };
  const smokeRotationExportUrl = buildAuditExportUrl(smokeRotationFilters);
  const rotationCountQuery = useAuditPage(
    { ...smokeRotationFilters, limit: 1, offset: 0 },
    isRotationRangeValid,
  );
  const rotationCount = rotationCountQuery.data?.total;
  const rotationCountStatus = !isRotationRangeValid
    ? "waiting"
    : rotationCountQuery.isFetching
      ? "loading"
      : rotationCountQuery.isError
        ? "error"
        : rotationCount === undefined
          ? "loading"
          : "ready";
  const rotationCountLabel = rotationCountStatus === "waiting"
    ? "시작일과 종료일을 순서대로 선택하세요."
    : rotationCountStatus === "error"
      ? "다운로드 대상 건수를 확인하지 못했습니다."
      : rotationCountStatus === "loading"
        ? "다운로드 대상 건수 확인 중..."
        : rotationCount === 0
          ? "다운로드 대상 0건 · CSV에는 헤더만 포함됩니다."
          : `다운로드 대상 ${(rotationCount ?? 0).toLocaleString("ko-KR")}건`;
  const isEmptyRotationExport = rotationCountStatus === "ready" && rotationCount === 0;
  return (
    <div className="mb-8 flex flex-wrap items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:shadow-none">
        <History className="h-5 w-5 text-blue-400" />
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-100">감사 로그</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">시스템의 모든 변경 사항을 추적합니다.</p>
      </div>
      <div className="ml-auto flex flex-wrap gap-2">
        <select
          aria-label="Secret 회전 CSV 기간"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:shadow-none"
          value={rotationCsvPeriod}
          onChange={(event) => setRotationCsvPeriod(event.target.value as RotationCsvPeriod)}
        >
          {ROTATION_CSV_PERIODS.map((period) => (
            <option key={period.value} value={period.value}>{period.label}</option>
          ))}
        </select>
        {isCustomRotationRange ? (
          <>
            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:shadow-none">
              시작 (UTC)
              <input
                aria-label="Secret 회전 CSV 시작일"
                className="bg-transparent text-xs text-slate-700 outline-none dark:text-slate-200"
                type="date"
                value={rotationStartDate}
                max={rotationEndDate || undefined}
                onChange={(event) => setRotationStartDate(event.target.value)}
              />
            </label>
            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:shadow-none">
              종료 (UTC)
              <input
                aria-label="Secret 회전 CSV 종료일"
                className="bg-transparent text-xs text-slate-700 outline-none dark:text-slate-200"
                type="date"
                value={rotationEndDate}
                min={rotationStartDate || undefined}
                onChange={(event) => setRotationEndDate(event.target.value)}
              />
            </label>
          </>
        ) : null}
        <a
          aria-label="Secret 회전 CSV 다운로드"
          aria-disabled={!isRotationRangeValid}
          className={`${EXPORT_LINK_CLASS} ${isRotationRangeValid ? "" : "cursor-not-allowed opacity-50"}`}
          href={isRotationRangeValid ? smokeRotationExportUrl : undefined}
          tabIndex={isRotationRangeValid ? undefined : -1}
        >
          <Download className="h-4 w-4" />
          Secret 회전 CSV
        </a>
        <span
          aria-live="polite"
          className={`self-center text-xs font-medium ${rotationCountStatus === "error" || rotationCountStatus === "waiting" || isEmptyRotationExport ? "text-amber-700 dark:text-amber-300" : "text-slate-500 dark:text-slate-400"}`}
          data-empty-result={isEmptyRotationExport}
          data-result-count={rotationCount ?? ""}
          data-count-status={rotationCountStatus}
          data-testid="secret-rotation-export-count"
        >
          {rotationCountLabel}
        </span>
        <a
          aria-label="현재 감사 조건 CSV 다운로드"
          className={EXPORT_LINK_CLASS}
          href={exportUrl}
        >
          <Download className="h-4 w-4" />
          현재 조건 CSV
        </a>
      </div>
    </div>
  );
}
