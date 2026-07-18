"use client";

import { Download, History } from "lucide-react";
import Link from "next/link";
import { useState, type KeyboardEvent } from "react";

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
  const latestRotationQuery = useAuditPage(
    { event: "smoke_rotation_result", limit: 1, offset: 0 },
    isEmptyRotationExport,
  );
  const latestRotationFailureQuery = useAuditPage(
    { event: "smoke_rotation_failed", limit: 1, offset: 0 },
    isEmptyRotationExport,
  );
  const latestRotation = latestRotationQuery.data?.items[0];
  const latestRotationDate = latestRotation?.created_at.slice(0, 10);
  const latestRotationStatus = latestRotation?.event === "smoke_rotation_succeeded"
    ? "success"
    : latestRotation?.event === "smoke_rotation_failed"
      ? "failure"
      : null;
  const latestRotationStatusLabel = latestRotationStatus === "success"
    ? "성공"
    : latestRotationStatus === "failure"
      ? "실패"
      : null;
  const latestRotationFailure = latestRotationFailureQuery.data?.items[0];
  const rawLatestRotationFailureStep = latestRotationFailure?.detail?.step;
  const latestRotationFailureStep = latestRotationFailure
    ? typeof rawLatestRotationFailureStep === "string" && rawLatestRotationFailureStep.trim()
      ? rawLatestRotationFailureStep.trim()
      : "알 수 없는 단계"
    : null;
  const latestRotationFailureDate = latestRotationFailure?.created_at.slice(0, 10);
  const latestRotationFailureExportUrl = latestRotationFailureDate
    ? buildAuditExportUrl({
        event: "smoke_rotation_failed",
        start_date: latestRotationFailureDate,
        end_date: latestRotationFailureDate,
      })
    : null;
  const latestRotationFailureDateCountQuery = useAuditPage(
    {
      event: "smoke_rotation_failed",
      start_date: latestRotationFailureDate,
      end_date: latestRotationFailureDate,
      limit: 1,
      offset: 0,
    },
    Boolean(isEmptyRotationExport && latestRotationFailureDate),
  );
  const latestRotationFailureDateCount = latestRotationFailureDateCountQuery.data?.total;
  const latestRotationFailureListUrl = latestRotationFailureDate
    ? `/dashboard/audit?filter=smoke_rotation_failed&start_date=${encodeURIComponent(latestRotationFailureDate)}&end_date=${encodeURIComponent(latestRotationFailureDate)}`
    : null;
  const setRotationRange = (date: string) => {
    setRotationCsvPeriod("custom");
    setRotationStartDate(date);
    setRotationEndDate(date);
  };
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
        {isEmptyRotationExport && latestRotationQuery.isFetching ? (
          <span className="self-center text-xs text-slate-500 dark:text-slate-400">
            최근 결과 날짜 확인 중...
          </span>
        ) : null}
        {isEmptyRotationExport && latestRotationDate ? (
          <button
            aria-label="Secret 회전 CSV 최근 결과 날짜로"
            className="self-center rounded-lg border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-800 hover:bg-cyan-100 dark:border-cyan-500/40 dark:bg-cyan-950 dark:text-cyan-200 dark:hover:bg-cyan-900"
            data-latest-date={latestRotationDate}
            data-latest-status={latestRotationStatus || undefined}
            data-testid="secret-rotation-export-latest"
            onClick={() => setRotationRange(latestRotationDate)}
            title={`가장 최근 Secret 회전 결과가 있는 ${latestRotationDate} UTC로 이동합니다${latestRotationStatusLabel ? ` (${latestRotationStatusLabel})` : ""}`}
            type="button"
          >
            최근 결과 {latestRotationDate}{latestRotationStatusLabel ? ` · ${latestRotationStatusLabel}` : ""}
          </button>
        ) : null}
        {isEmptyRotationExport && latestRotationFailureDate && latestRotationFailureStep && latestRotationFailure ? (
          <Link
            aria-label="최근 Secret 회전 실패 감사 상세"
            className="max-w-80 self-center truncate rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-950/60 dark:text-rose-200 dark:hover:bg-rose-900"
            data-latest-failure-audit-id={latestRotationFailure.id}
            data-latest-failure-date={latestRotationFailureDate}
            data-latest-failure-step={latestRotationFailureStep}
            data-testid="secret-rotation-export-latest-failure"
            href={`/dashboard/audit?q=${encodeURIComponent(latestRotationFailure.id)}&expand=${encodeURIComponent(latestRotationFailure.id)}`}
            title={`최근 회전 실패 단계: ${latestRotationFailureStep}`}
          >
            최근 실패 {latestRotationFailureDate} UTC · 단계: {latestRotationFailureStep}
          </Link>
        ) : null}
        {isEmptyRotationExport && latestRotationFailureDate && latestRotationFailureExportUrl ? (
          <span
            aria-label="최근 Secret 회전 실패 날짜 작업"
            className="inline-flex self-center overflow-hidden rounded-lg border border-rose-200 bg-white dark:border-rose-500/30 dark:bg-slate-900"
            data-keyboard-navigation="horizontal"
            data-testid="secret-rotation-export-latest-failure-actions"
            onKeyDown={handleFailureActionKeyDown}
            role="group"
            title="좌우 방향키로 작업을 이동할 수 있습니다"
          >
            <a
              aria-label="최근 Secret 회전 실패 날짜 CSV 다운로드"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:text-rose-200 dark:hover:bg-rose-950"
              data-latest-failure-date={latestRotationFailureDate}
              data-result-count={latestRotationFailureDateCount ?? ""}
              data-testid="secret-rotation-export-latest-failure-csv"
              href={latestRotationFailureExportUrl}
            >
              <Download className="h-3.5 w-3.5" />
              실패 날짜 CSV
            </a>
            {latestRotationFailureListUrl && latestRotationFailureDateCount !== undefined ? (
              <a
                aria-label="최근 Secret 회전 실패 날짜 감사 목록"
                className="border-l border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-950/60 dark:text-rose-200 dark:hover:bg-rose-900"
                data-latest-failure-date={latestRotationFailureDate}
                data-result-count={latestRotationFailureDateCount}
                data-testid="secret-rotation-export-latest-failure-list"
                href={latestRotationFailureListUrl}
              >
                {latestRotationFailureDateCount.toLocaleString("ko-KR")}건 보기
              </a>
            ) : null}
          </span>
        ) : null}
        {isEmptyRotationExport ? (
          <button
            aria-label="Secret 회전 CSV 오늘 범위로"
            className="self-center rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900"
            data-testid="secret-rotation-export-today"
            onClick={() => setRotationRange(new Date().toISOString().slice(0, 10))}
            title="UTC 기준 오늘 날짜로 시작일과 종료일을 설정합니다"
            type="button"
          >
            오늘 범위로
          </button>
        ) : null}
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

function handleFailureActionKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
  const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
  if (!direction) return;
  const actions = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>("a"));
  const currentIndex = actions.indexOf(document.activeElement as HTMLAnchorElement);
  if (currentIndex < 0 || actions.length < 2) return;
  event.preventDefault();
  actions[(currentIndex + direction + actions.length) % actions.length]?.focus();
}
