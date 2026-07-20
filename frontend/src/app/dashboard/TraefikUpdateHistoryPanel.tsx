"use client";

import { CheckCircle2, Clock3, Download, RotateCcw, ServerCog } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import type { TraefikUpdateOperations } from "@/features/traefik/api/traefikApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

import {
  DEFAULT_TRAEFIK_UPDATE_HISTORY_FILTERS,
  filterTraefikUpdateHistory,
  isTraefikUpdateHistoryDateRangeValid,
  readTraefikUpdateHistoryFilters,
  replaceTraefikUpdateHistoryQuery,
  type TraefikUpdateHistoryFilters,
  type TraefikUpdateHistoryPeriod,
  type TraefikUpdateHistoryRetry,
  type TraefikUpdateHistoryStatus,
} from "./traefikUpdateHistoryFilter";
import {
  downloadTraefikUpdateHistory,
  type TraefikUpdateHistoryExportFormat,
} from "./traefikUpdateHistoryExport";
import { TraefikUpdateAlertRun } from "./TraefikUpdateAlertRun";

interface TraefikUpdateHistoryPanelProps {
  canManage: boolean;
  isError: boolean;
  isLoading: boolean;
  operations?: TraefikUpdateOperations;
  timezone?: string;
}

const MAX_VISIBLE_ENTRIES = 5;

export function TraefikUpdateHistoryPanel({
  ...props
}: TraefikUpdateHistoryPanelProps) {
  return (
    <Suspense fallback={null}>
      <TraefikUpdateHistoryPanelContent {...props} />
    </Suspense>
  );
}

function TraefikUpdateHistoryPanelContent({
  canManage,
  isError,
  isLoading,
  operations,
  timezone,
}: TraefikUpdateHistoryPanelProps) {
  const searchParams = useSearchParams();
  const history = operations?.history ?? [];
  const [filters, setFilters] = useState<TraefikUpdateHistoryFilters>(() =>
    readTraefikUpdateHistoryFilters(searchParams),
  );
  const [periodReferenceTime, setPeriodReferenceTime] = useState(() => Date.now());
  const [exportNotice, setExportNotice] = useState("");
  const dateRangeValid = isTraefikUpdateHistoryDateRangeValid(filters);
  const filteredHistory = filterTraefikUpdateHistory(
    history,
    filters,
    periodReferenceTime,
  );
  const updateFilters = (updates: Partial<TraefikUpdateHistoryFilters>) => {
    const nextFilters = { ...filters, ...updates };
    setFilters(nextFilters);
    replaceTraefikUpdateHistoryQuery(nextFilters);
    setExportNotice("");
  };
  const handleExport = (format: TraefikUpdateHistoryExportFormat) => {
    try {
      const filename = downloadTraefikUpdateHistory(filteredHistory, filters, format, timezone);
      setExportNotice(`${filename} · ${filteredHistory.length}건 내보내기 완료`);
    } catch {
      setExportNotice(`${format.toUpperCase()} 파일을 생성하지 못했습니다.`);
    }
  };
  return (
    <div
      className="mt-4 rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-950/55"
      data-traefik-update-runner={operations?.runner.status || "loading"}
      id="traefik-update-history"
      data-testid="traefik-update-operations"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
            <ServerCog className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
            Traefik 호스트 업데이트 이력
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            백업, 런타임 검증, 자동 롤백 결과를 요청별로 보관합니다.
          </p>
        </div>
        <RunnerBadge operations={operations} />
      </div>

      {operations?.pending_request ? (
        <p className="mt-3 rounded-lg bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-800 dark:bg-cyan-500/10 dark:text-cyan-200">
          호스트 실행기가 업데이트 요청을 처리하고 있습니다.
        </p>
      ) : null}
      {!isLoading && !isError ? (
        <HistoryFilters
          dateRangeValid={dateRangeValid}
          displayedCount={Math.min(filteredHistory.length, MAX_VISIBLE_ENTRIES)}
          filteredCount={filteredHistory.length}
          filters={filters}
          onExport={handleExport}
          onFiltersChange={updateFilters}
          onPeriodChange={(period) => {
            setPeriodReferenceTime(Date.now());
            updateFilters({ dateFrom: "", dateTo: "", period });
          }}
          totalCount={history.length}
        />
      ) : null}
      {exportNotice ? (
        <p aria-live="polite" className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
          {exportNotice}
        </p>
      ) : null}
      {isLoading ? (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">업데이트 이력 확인 중...</p>
      ) : isError ? (
        <p className="mt-3 text-xs font-semibold text-rose-700 dark:text-rose-300">
          호스트 업데이트 이력을 불러오지 못했습니다.
        </p>
      ) : history.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Manager에서 요청한 업데이트 이력이 아직 없습니다.
        </p>
      ) : filteredHistory.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          {dateRangeValid
            ? "선택한 조건에 맞는 업데이트 이력이 없습니다."
            : "시작일은 종료일보다 늦을 수 없습니다."}
        </p>
      ) : (
        <ol
          className="mt-3 grid gap-2"
          data-testid="traefik-update-history"
          data-traefik-update-filter-status={filters.status}
        >
          {filteredHistory.slice(0, MAX_VISIBLE_ENTRIES).map((entry) => {
            const successfulChecks = entry.validations.filter((check) => check.status === "ok").length;
            return (
              <li
                className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs dark:border-slate-700 dark:bg-slate-900"
                data-traefik-update-request-id={entry.request_id}
                data-traefik-update-status={entry.status}
                key={entry.request_id}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 font-bold ${getStatusClassName(entry.status)}`}>
                    {getStatusLabel(entry.status)}
                  </span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">
                    {entry.from_version} → {entry.target_version}
                  </span>
                  <span className="ml-auto text-[11px] text-slate-500 dark:text-slate-400">
                    {entry.actor} · {formatDateTime(entry.completed_at || entry.started_at, timezone)}
                  </span>
                </div>
                <p className="mt-2 leading-5 text-slate-600 dark:text-slate-300">{entry.message}</p>
                {entry.backup_dir ? (
                  <p className="mt-1 truncate font-mono text-[11px] text-slate-500 dark:text-slate-400" title={entry.backup_dir}>
                    백업: {entry.backup_dir}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
                  {entry.backup_created ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" /> 백업 생성
                    </span>
                  ) : null}
                  {entry.validations.length ? (
                    <span className="inline-flex items-center gap-1 text-cyan-700 dark:text-cyan-300">
                      <CheckCircle2 className="h-3 w-3" /> 검증 {successfulChecks}/{entry.validations.length}
                    </span>
                  ) : null}
                  {entry.rollback_performed ? (
                    <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                      <RotateCcw className="h-3 w-3" /> 자동 롤백 수행
                    </span>
                  ) : null}
                </div>
                <TraefikUpdateAlertRun
                  canManage={canManage}
                  entry={entry}
                  pendingRequest={operations?.pending_request === true}
                  runnerAvailable={operations?.runner.available === true}
                  timezone={timezone}
                />
                {entry.validations.length ? (
                  <details className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <summary className="cursor-pointer font-semibold">검증 상세</summary>
                    <ul className="mt-1 grid gap-1">
                      {entry.validations.map((check) => (
                        <li key={check.key}>{check.status === "ok" ? "정상" : "실패"} · {check.message}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

const STATUS_OPTIONS: readonly { label: string; value: TraefikUpdateHistoryStatus }[] = [
  { label: "전체 상태", value: "all" },
  { label: "완료", value: "success" },
  { label: "처리 중", value: "running" },
  { label: "요청 거부", value: "rejected" },
  { label: "자동 롤백", value: "rolled_back" },
  { label: "롤백 실패", value: "rollback_failed" },
];

const PERIOD_OPTIONS: readonly { label: string; value: TraefikUpdateHistoryPeriod }[] = [
  { label: "전체 기간", value: "all" },
  { label: "최근 24시간", value: "1" },
  { label: "최근 7일", value: "7" },
  { label: "최근 30일", value: "30" },
  { label: "최근 90일", value: "90" },
];

const RETRY_OPTIONS: readonly { label: string; value: TraefikUpdateHistoryRetry }[] = [
  { label: "재시도 전체", value: "all" },
  { label: "재시도 있음", value: "retried" },
  { label: "재시도 없음", value: "not_retried" },
];

function HistoryFilters({
  dateRangeValid,
  displayedCount,
  filteredCount,
  filters,
  onExport,
  onFiltersChange,
  onPeriodChange,
  totalCount,
}: {
  dateRangeValid: boolean;
  displayedCount: number;
  filteredCount: number;
  filters: TraefikUpdateHistoryFilters;
  onExport: (format: TraefikUpdateHistoryExportFormat) => void;
  onFiltersChange: (updates: Partial<TraefikUpdateHistoryFilters>) => void;
  onPeriodChange: (period: TraefikUpdateHistoryPeriod) => void;
  totalCount: number;
}) {
  const hasActiveFilters = filters.status !== "all"
    || filters.period !== "all"
    || filters.retry !== "all"
    || Boolean(filters.actor.trim())
    || Boolean(filters.dateFrom)
    || Boolean(filters.dateTo);
  const controlClassName = "min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
  return (
    <div className="mt-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/80">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <label className="grid min-w-0 gap-1 text-[11px] text-slate-500 dark:text-slate-400">
          업데이트 상태
          <select
            aria-label="업데이트 이력 상태"
            className={controlClassName}
            data-traefik-update-status-filter
            onChange={(event) => onFiltersChange({
              status: event.target.value as TraefikUpdateHistoryStatus,
            })}
            value={filters.status}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-[11px] text-slate-500 dark:text-slate-400">
          요청자 또는 요청 ID
          <input
            aria-label="업데이트 이력 요청자 또는 요청 ID"
            className={controlClassName}
            data-traefik-update-actor-filter
            maxLength={100}
            onChange={(event) => onFiltersChange({ actor: event.target.value })}
            placeholder="요청자 또는 요청 UUID"
            type="search"
            value={filters.actor}
          />
        </label>
        <label className="grid min-w-0 gap-1 text-[11px] text-slate-500 dark:text-slate-400">
          재시도 여부
          <select
            aria-label="업데이트 이력 재시도 여부"
            className={controlClassName}
            data-traefik-update-retry-filter
            onChange={(event) => onFiltersChange({
              retry: event.target.value as TraefikUpdateHistoryRetry,
            })}
            value={filters.retry}
          >
            {RETRY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-[11px] text-slate-500 dark:text-slate-400">
          상대 기간
          <select
            aria-label="업데이트 이력 기간"
            className={controlClassName}
            data-traefik-update-period-filter
            onChange={(event) => onPeriodChange(
              event.target.value as TraefikUpdateHistoryPeriod,
            )}
            value={filters.period}
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-[11px] text-slate-500 dark:text-slate-400">
          시작일
          <input
            aria-label="업데이트 이력 시작일"
            className={controlClassName}
            data-traefik-update-date-from
            max={filters.dateTo || undefined}
            onChange={(event) => onFiltersChange({ dateFrom: event.target.value, period: "all" })}
            type="date"
            value={filters.dateFrom}
          />
        </label>
        <label className="grid min-w-0 gap-1 text-[11px] text-slate-500 dark:text-slate-400">
          종료일
          <input
            aria-label="업데이트 이력 종료일"
            className={controlClassName}
            data-traefik-update-date-to
            min={filters.dateFrom || undefined}
            onChange={(event) => onFiltersChange({ dateTo: event.target.value, period: "all" })}
            type="date"
            value={filters.dateTo}
          />
        </label>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2 dark:border-slate-700">
        <span aria-live="polite" className="text-[11px] text-slate-500 dark:text-slate-400">
          현재 결과 {filteredCount}/{totalCount}건
          {displayedCount < filteredCount ? ` · 화면 ${displayedCount}건` : ""}
        </span>
        <div className="flex flex-wrap gap-1.5 sm:ml-auto">
          {(["json", "csv"] as const).map((format) => (
            <button
              aria-label={`현재 업데이트 이력 ${filteredCount}건 ${format.toUpperCase()} 다운로드`}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-cyan-300 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-cyan-500 dark:hover:text-cyan-200"
              data-traefik-update-export={format}
              disabled={!dateRangeValid || filteredCount === 0}
              key={format}
              onClick={() => onExport(format)}
              type="button"
            >
              <Download className="h-3 w-3" /> {format.toUpperCase()}
            </button>
          ))}
          <button
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-cyan-300 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-cyan-500 dark:hover:text-cyan-200"
            data-traefik-update-filter-reset
            disabled={!hasActiveFilters}
            onClick={() => onFiltersChange(DEFAULT_TRAEFIK_UPDATE_HISTORY_FILTERS)}
            type="button"
          >
            <RotateCcw className="h-3 w-3" /> 초기화
          </button>
        </div>
      </div>
    </div>
  );
}

function RunnerBadge({ operations }: { operations?: TraefikUpdateOperations }) {
  const runner = operations?.runner;
  const isAvailable = runner?.available === true;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        isAvailable
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      }`}
      title={runner?.message}
    >
      {isAvailable ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
      {isAvailable ? "호스트 실행기 준비됨" : "호스트 실행기 확인 필요"}
    </span>
  );
}

function getStatusLabel(status: TraefikUpdateOperations["history"][number]["status"]) {
  if (status === "success") return "완료";
  if (status === "running") return "처리 중";
  if (status === "rejected") return "요청 거부";
  if (status === "rolled_back") return "자동 롤백";
  return "롤백 실패";
}

function getStatusClassName(status: TraefikUpdateOperations["history"][number]["status"]) {
  if (status === "success") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
  if (status === "running") return "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200";
  if (status === "rolled_back") return "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200";
  return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";
}
