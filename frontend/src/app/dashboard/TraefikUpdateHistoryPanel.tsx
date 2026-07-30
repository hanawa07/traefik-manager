"use client";

import { CheckCircle2, Clock3, ServerCog } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import type { TraefikUpdateOperations } from "@/features/traefik/api/traefikApi";

import {
  filterTraefikUpdateHistory,
  isTraefikUpdateHistoryDateRangeValid,
  readTraefikUpdateHistoryFilters,
  replaceTraefikUpdateHistoryQuery,
  type TraefikUpdateHistoryFilters,
} from "./traefikUpdateHistoryFilter";
import {
  downloadTraefikUpdateHistory,
  type TraefikUpdateHistoryExportFormat,
} from "./traefikUpdateHistoryExport";
import { TraefikUpdateHistoryFilters as HistoryFilters } from "./TraefikUpdateHistoryFilters";
import { TraefikUpdateHistoryItem } from "./TraefikUpdateHistoryItem";

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
      data-testid="traefik-update-operations"
      id="traefik-update-history"
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
          {filteredHistory.slice(0, MAX_VISIBLE_ENTRIES).map((entry) => (
            <TraefikUpdateHistoryItem
              canManage={canManage}
              entry={entry}
              key={entry.request_id}
              pendingRequest={operations?.pending_request === true}
              runnerAvailable={operations?.runner.available === true}
              timezone={timezone}
            />
          ))}
        </ol>
      )}
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
      {isAvailable
        ? <CheckCircle2 className="h-3.5 w-3.5" />
        : <Clock3 className="h-3.5 w-3.5" />}
      {isAvailable ? "호스트 실행기 준비됨" : "호스트 실행기 확인 필요"}
    </span>
  );
}
