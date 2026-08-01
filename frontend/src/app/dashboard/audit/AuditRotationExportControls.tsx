"use client";

import { Download } from "lucide-react";
import Link from "next/link";
import type { KeyboardEvent } from "react";

import {
  ROTATION_CSV_PERIODS,
  type RotationCsvPeriod,
  useAuditRotationExportModel,
} from "./useAuditRotationExportModel";

interface AuditRotationExportControlsProps {
  linkClassName: string;
}

export function AuditRotationExportControls({ linkClassName }: AuditRotationExportControlsProps) {
  const {
    isCustomRotationRange,
    isEmptyRotationExport,
    isLatestRotationFetching,
    isRotationRangeValid,
    latestRotationDate,
    latestRotationFailure,
    latestRotationFailureDate,
    latestRotationFailureDateCount,
    latestRotationFailureExportUrl,
    latestRotationFailureListUrl,
    latestRotationFailureStep,
    latestRotationStatus,
    latestRotationStatusLabel,
    rotationCount,
    rotationCountLabel,
    rotationCountStatus,
    rotationCsvPeriod,
    rotationEndDate,
    rotationStartDate,
    setRotationCsvPeriod,
    setRotationEndDate,
    setRotationRange,
    setRotationStartDate,
    smokeRotationExportUrl,
  } = useAuditRotationExportModel();

  return (
    <>
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
        className={`${linkClassName} ${isRotationRangeValid ? "" : "cursor-not-allowed opacity-50"}`}
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
      {isEmptyRotationExport && isLatestRotationFetching ? (
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
    </>
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
