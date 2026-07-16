"use client";

import { useSearchParams } from "next/navigation";
import { History, RotateCcw, Search } from "lucide-react";
import { Suspense, useState } from "react";

import type { ManagerDeploymentHistoryEntry } from "@/features/deployment/api/deploymentApi";
import ToastNotice, { type ToastNoticeValue } from "@/shared/components/ToastNotice";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

import { buildManagerDeploymentLinks } from "./managerDeploymentLinks";
import {
  downloadManagerDeploymentHistory,
  type ManagerDeploymentHistoryExportFormat,
} from "./managerDeploymentHistoryExport";
import {
  MANAGER_DEPLOYMENT_HISTORY_QUERY,
  parseManagerDeploymentHistorySource,
  parseManagerDeploymentHistoryStage,
  parseManagerDeploymentHistoryStatus,
  replaceManagerDeploymentHistoryQueryParams,
  type ManagerDeploymentHistoryFailureStage,
  type ManagerDeploymentHistoryStatusFilter,
} from "./managerDeploymentHistoryQuery";
import {
  getExternalWatchdogRunLabel,
  isExternalWatchdogRunFailure,
} from "./managerWatchdogStatus";

interface ManagerDeploymentHistoryProps {
  archiveEntries?: ManagerDeploymentHistoryEntry[];
  entries?: ManagerDeploymentHistoryEntry[];
  source?: string | null;
  timezone?: string;
}

const STATUS_DISPLAY = {
  success: {
    label: "전환 완료",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  },
  failed_before_switch: {
    label: "전환 전 중단",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-100",
  },
  rolled_back: {
    label: "자동 롤백",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-100",
  },
  rollback_failed: {
    label: "롤백 실패",
    className: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200",
  },
} as const;

const FILTER_OPTIONS: readonly { value: ManagerDeploymentHistoryStatusFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "success", label: STATUS_DISPLAY.success.label },
  { value: "failed_before_switch", label: STATUS_DISPLAY.failed_before_switch.label },
  { value: "rolled_back", label: STATUS_DISPLAY.rolled_back.label },
  { value: "rollback_failed", label: STATUS_DISPLAY.rollback_failed.label },
];

const FAILURE_STAGE_LABELS: Record<ManagerDeploymentHistoryFailureStage, string> = {
  prepare: "사전 준비",
  build: "이미지 빌드",
  migration_preflight: "DB migration 사전 검사",
  candidate_health: "후보 컨테이너 준비",
  route_switch: "Traefik route 전환",
  leader_handover: "background leader 승계",
  public_probe: "공개 health probe",
  state_write: "배포 상태 확정",
};

export function ManagerDeploymentHistory(props: ManagerDeploymentHistoryProps) {
  return (
    <Suspense fallback={null}>
      <ManagerDeploymentHistoryContent {...props} />
    </Suspense>
  );
}

function ManagerDeploymentHistoryContent({
  archiveEntries = [],
  entries = [],
  source,
  timezone,
}: ManagerDeploymentHistoryProps) {
  const searchParams = useSearchParams();
  const [toastNotice, setToastNotice] = useState<ToastNoticeValue | null>(null);
  const filter = parseManagerDeploymentHistoryStatus(
    searchParams.get(MANAGER_DEPLOYMENT_HISTORY_QUERY.status),
  );
  const failureStageFilter = parseManagerDeploymentHistoryStage(
    searchParams.get(MANAGER_DEPLOYMENT_HISTORY_QUERY.stage),
  );
  const historySource = parseManagerDeploymentHistorySource(
    searchParams.get(MANAGER_DEPLOYMENT_HISTORY_QUERY.source),
  );
  const searchText = (searchParams.get(MANAGER_DEPLOYMENT_HISTORY_QUERY.search) || "").slice(0, 100);
  const normalizedSearchText = searchText.trim().toLowerCase();
  const showArchive = historySource === "archive";
  const visibleEntries = showArchive ? archiveEntries : entries;
  const filteredEntries = visibleEntries.filter((entry) => {
    const matchesStatus = filter === "all" || entry.status === filter;
    const matchesFailureStage = failureStageFilter === "all"
      || (failureStageFilter === "unknown"
        ? entry.status !== "success" && !entry.failure_stage
        : entry.failure_stage === failureStageFilter);
    const matchesSearch = !normalizedSearchText || [entry.version, entry.revision, entry.failure_reason]
      .some((value) => value?.toLowerCase().includes(normalizedSearchText));
    return matchesStatus && matchesFailureStage && matchesSearch;
  });
  const failedEntries = visibleEntries.filter((entry) => entry.status !== "success");
  const failureStageCounts = (Object.keys(FAILURE_STAGE_LABELS) as ManagerDeploymentHistoryFailureStage[])
    .map((stage) => ({
      count: failedEntries.filter((entry) => entry.failure_stage === stage).length,
      label: FAILURE_STAGE_LABELS[stage],
      stage,
    }))
    .filter(({ count }) => count > 0);
  const unknownStageCount = failedEntries.filter((entry) => !entry.failure_stage).length;
  const hasActiveFilters = filter !== "all" || failureStageFilter !== "all" || searchText.trim() !== "";

  const handleExport = (format: ManagerDeploymentHistoryExportFormat) => {
    try {
      const filename = downloadManagerDeploymentHistory(filteredEntries, historySource, format);
      setToastNotice({
        detail: `${filename} · ${filteredEntries.length}건`,
        message: `${format.toUpperCase()} 내보내기 완료`,
        tone: "success",
      });
    } catch {
      setToastNotice({
        detail: "배포 이력 파일을 생성하지 못했습니다.",
        message: `${format.toUpperCase()} 내보내기 실패`,
        tone: "error",
      });
    }
  };

  return (
    <>
      <ToastNotice notice={toastNotice} onClose={() => setToastNotice(null)} />
      <section
        className="mt-4 rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/60"
        data-history-source={historySource}
        data-manager-deployment-history
      >
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">배포 전환 이력</h3>
          <span className="text-xs text-gray-500 dark:text-slate-400">
            {showArchive ? "회전 보관" : "최근"} {visibleEntries.length}건
          </span>
        </div>
        <div className="flex flex-wrap gap-1 sm:ml-auto">
          {archiveEntries.length > 0 || showArchive ? (
            <button
              className="rounded-full border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-600 hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-200"
              data-history-source-toggle
              onClick={() => {
                replaceManagerDeploymentHistoryQueryParams([
                  [MANAGER_DEPLOYMENT_HISTORY_QUERY.source, showArchive ? "current" : "archive", "current"],
                  [MANAGER_DEPLOYMENT_HISTORY_QUERY.status, "all", "all"],
                  [MANAGER_DEPLOYMENT_HISTORY_QUERY.stage, "all", "all"],
                ]);
              }}
              type="button"
            >
              {showArchive ? "현재 이력 보기" : `회전 보관 ${archiveEntries.length}건 보기`}
            </button>
          ) : null}
          {visibleEntries.length > 0 ? (["json", "csv"] as const).map((format) => (
            <button
              aria-label={`현재 화면 ${format.toUpperCase()} 내보내기`}
              className="rounded-full border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-600 hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-200"
              data-history-export={format}
              key={format}
              onClick={() => handleExport(format)}
              type="button"
            >
              {format.toUpperCase()} 내보내기
            </button>
          )) : null}
        </div>
      </div>

      {visibleEntries.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="relative min-w-0 basis-full sm:basis-64 sm:flex-1">
            <span className="sr-only">배포 이력 검색</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
            <input
              aria-label="배포 이력 검색"
              autoComplete="off"
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-xs text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              data-history-search
              maxLength={100}
              onChange={(event) => replaceManagerDeploymentHistoryQueryParams([
                [MANAGER_DEPLOYMENT_HISTORY_QUERY.search, event.target.value.slice(0, 100), ""],
              ])}
              placeholder="버전·커밋·실패 원인 검색"
              spellCheck={false}
              type="search"
              value={searchText}
            />
          </label>
          <span aria-live="polite" className="text-[11px] text-gray-500 dark:text-slate-400">
            {filteredEntries.length}/{visibleEntries.length}건
          </span>
          <button
            aria-label="배포 이력 조건 초기화"
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-gray-600 hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-200"
            data-history-filter-reset
            disabled={!hasActiveFilters}
            onClick={() => replaceManagerDeploymentHistoryQueryParams([
              [MANAGER_DEPLOYMENT_HISTORY_QUERY.search, "", ""],
              [MANAGER_DEPLOYMENT_HISTORY_QUERY.status, "all", "all"],
              [MANAGER_DEPLOYMENT_HISTORY_QUERY.stage, "all", "all"],
            ])}
            type="button"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            조건 초기화
          </button>
        </div>
      ) : null}

      {visibleEntries.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1" role="group" aria-label="배포 이력 상태 필터">
          {FILTER_OPTIONS.map((option) => {
            const count = option.value === "all"
              ? visibleEntries.length
              : visibleEntries.filter((entry) => entry.status === option.value).length;
            const active = filter === option.value;
            return (
              <button
                aria-pressed={active}
                className={`rounded-full border px-2 py-1 text-[11px] font-semibold transition-colors ${
                  active
                    ? "border-blue-600 bg-blue-600 text-white dark:border-blue-400 dark:bg-blue-400 dark:text-slate-950"
                    : "border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-200"
                }`}
                data-history-filter={option.value}
                key={option.value}
                onClick={() => replaceManagerDeploymentHistoryQueryParams([
                  [MANAGER_DEPLOYMENT_HISTORY_QUERY.status, option.value, "all"],
                ])}
                type="button"
              >
                {option.label} {count}
              </button>
            );
          })}
        </div>
      ) : null}

      {failedEntries.length > 0 ? (
        <div
          className="mt-3 flex flex-wrap items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/80 px-2.5 py-2 text-[11px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
          data-deployment-failure-stats
          role="group"
          aria-label="배포 실패 단계 필터"
        >
          <span className="font-semibold">실패 {failedEntries.length}건</span>
          <button
            aria-pressed={failureStageFilter === "all"}
            className={`rounded-full px-2 py-0.5 font-semibold transition-colors ${
              failureStageFilter === "all"
                ? "bg-amber-700 text-white dark:bg-amber-300 dark:text-slate-950"
                : "bg-white/80 hover:bg-white dark:bg-slate-900/70 dark:hover:bg-slate-900"
            }`}
            data-failure-stage-filter="all"
            onClick={() => replaceManagerDeploymentHistoryQueryParams([
              [MANAGER_DEPLOYMENT_HISTORY_QUERY.stage, "all", "all"],
            ])}
            type="button"
          >
            단계 전체
          </button>
          {failureStageCounts.map(({ count, label, stage }) => (
            <button
              aria-pressed={failureStageFilter === stage}
              className={`rounded-full px-2 py-0.5 font-medium transition-colors ${
                failureStageFilter === stage
                  ? "bg-amber-700 text-white dark:bg-amber-300 dark:text-slate-950"
                  : "bg-white/80 hover:bg-white dark:bg-slate-900/70 dark:hover:bg-slate-900"
              }`}
              data-failure-stage-filter={stage}
              key={stage}
              onClick={() => replaceManagerDeploymentHistoryQueryParams([
                [MANAGER_DEPLOYMENT_HISTORY_QUERY.stage, failureStageFilter === stage ? "all" : stage, "all"],
              ])}
              type="button"
            >
              {label} {count}
            </button>
          ))}
          {unknownStageCount > 0 ? (
            <button
              aria-pressed={failureStageFilter === "unknown"}
              className={`rounded-full px-2 py-0.5 font-medium transition-colors ${
                failureStageFilter === "unknown"
                  ? "bg-amber-700 text-white dark:bg-amber-300 dark:text-slate-950"
                  : "bg-white/80 hover:bg-white dark:bg-slate-900/70 dark:hover:bg-slate-900"
              }`}
              data-failure-stage-filter="unknown"
              onClick={() => replaceManagerDeploymentHistoryQueryParams([
                [MANAGER_DEPLOYMENT_HISTORY_QUERY.stage, failureStageFilter === "unknown" ? "all" : "unknown", "all"],
              ])}
              type="button"
            >
              단계 미기록 {unknownStageCount}
            </button>
          ) : null}
        </div>
      ) : null}

      {visibleEntries.length === 0 ? (
        <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">
          {showArchive ? "회전 보관된 배포가 없습니다." : "기록된 blue-green 배포가 없습니다."}
        </p>
      ) : filteredEntries.length === 0 ? (
        <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">
          선택한 필터의 배포 이력이 없습니다.
        </p>
      ) : (
        <ol className="mt-3 grid gap-2 lg:grid-cols-2">
          {filteredEntries.map((entry) => {
            const status = STATUS_DISPLAY[entry.status];
            const links = buildManagerDeploymentLinks({
              latestVersion: entry.version,
              revision: entry.revision,
              source,
            });
            return (
              <li
                className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900"
                data-deployment-failure-stage={entry.failure_stage ?? (entry.status === "success" ? undefined : "unknown")}
                data-deployment-status={entry.status}
                key={`${entry.completed_at}-${entry.to_slot}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>
                      {status.label}
                    </span>
                    <span className="text-xs font-semibold text-gray-800 dark:text-slate-200">
                      {entry.from_slot} → {entry.to_slot}
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-500 dark:text-slate-400">
                    활성 {entry.active_slot}
                  </span>
                </div>
                <p className="mt-2 text-xs text-gray-600 dark:text-slate-300">
                  {links.releaseUrl ? (
                    <a
                      className="font-semibold underline decoration-gray-300 underline-offset-2 hover:text-blue-700 dark:decoration-slate-600 dark:hover:text-blue-300"
                      href={links.releaseUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {entry.version}
                    </a>
                  ) : entry.version}
                  {" · "}
                  {links.commitUrl ? (
                    <a
                      className="font-mono underline decoration-gray-300 underline-offset-2 hover:text-blue-700 dark:decoration-slate-600 dark:hover:text-blue-300"
                      href={links.commitUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {entry.revision.slice(0, 12)}
                    </a>
                  ) : (
                    <span className="font-mono">{entry.revision.slice(0, 12)}</span>
                  )}
                </p>
                <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">
                  {formatProbe(entry)} · {formatDateTime(entry.completed_at, timezone)}
                </p>
                {entry.failure_reason ? (
                  <p
                    className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-100"
                    data-deployment-failure-detail
                  >
                    {entry.failure_stage ? `${FAILURE_STAGE_LABELS[entry.failure_stage]} · ` : ""}
                    {entry.failure_reason}
                  </p>
                ) : null}
                <DeploymentAlertRun entry={entry} timezone={timezone} />
              </li>
            );
          })}
        </ol>
      )}
      </section>
    </>
  );
}

function DeploymentAlertRun({
  entry,
  timezone,
}: {
  entry: ManagerDeploymentHistoryEntry;
  timezone?: string;
}) {
  if (entry.alert_request_status === "not_needed") return null;

  const requestFailed = entry.alert_request_status === "request_failed";
  const runFailed = isExternalWatchdogRunFailure(entry.alert_run_conclusion);
  const resultChecked = Boolean(
    entry.alert_run_status || entry.alert_run_checked_at || entry.alert_run_error,
  );
  const resultLabel = resultChecked
    ? getExternalWatchdogRunLabel(
        entry.alert_run_status,
        entry.alert_run_conclusion,
        entry.alert_run_error,
      )
    : "결과 조회 대기";
  const tone = requestFailed || runFailed
    ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200"
    : entry.alert_run_error
      ? "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-100"
      : "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200";

  return (
    <p
      className={`mt-2 rounded-md px-2 py-1.5 text-[11px] font-medium ${tone}`}
      data-deployment-alert-run={entry.alert_request_status}
    >
      {requestFailed ? "운영 알림 요청 실패" : "운영 알림 요청됨"}
      {entry.alert_run_url ? (
        <>
          {" · "}
          <a
            className="font-semibold underline underline-offset-2 hover:text-blue-900 dark:hover:text-white"
            href={entry.alert_run_url}
            rel="noreferrer"
            target="_blank"
          >
            알림 실행 {resultLabel}
          </a>
        </>
      ) : requestFailed ? null : (
        " · 실행 링크 미확인"
      )}
      {entry.alert_run_checked_at
        ? ` · 확인 ${formatDateTime(entry.alert_run_checked_at, timezone)}`
        : ""}
      {entry.alert_run_error ? ` · ${entry.alert_run_error}` : ""}
    </p>
  );
}

function formatProbe(entry: ManagerDeploymentHistoryEntry): string {
  if (entry.probe_total === 0) return "공개 probe 전 종료";
  if (entry.probe_failures > 0) {
    return `probe ${entry.probe_total}건 중 ${entry.probe_failures}건 실패`;
  }
  return `probe ${entry.probe_total}건 모두 HTTP 200`;
}
