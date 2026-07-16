"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import type { ManagerDeploymentHistoryEntry } from "@/features/deployment/api/deploymentApi";
import ToastNotice, { type ToastNoticeValue } from "@/shared/components/ToastNotice";

import {
  ManagerDeploymentHistoryControls,
  type ManagerDeploymentHistoryFilters,
} from "./ManagerDeploymentHistoryControls";
import { ManagerDeploymentHistoryItem } from "./ManagerDeploymentHistoryItem";
import {
  downloadManagerDeploymentHistory,
  type ManagerDeploymentHistoryExportFormat,
} from "./managerDeploymentHistoryExport";
import {
  MANAGER_DEPLOYMENT_HISTORY_QUERY,
  parseManagerDeploymentHistoryPeriod,
  parseManagerDeploymentHistorySource,
  parseManagerDeploymentHistoryStage,
  parseManagerDeploymentHistoryStatus,
  replaceManagerDeploymentHistoryQueryParams,
  type ManagerDeploymentHistoryPeriodFilter,
  type ManagerDeploymentHistorySourceFilter,
  type ManagerDeploymentHistoryStageFilter,
  type ManagerDeploymentHistoryStatusFilter,
} from "./managerDeploymentHistoryQuery";

interface ManagerDeploymentHistoryProps {
  archiveEntries?: ManagerDeploymentHistoryEntry[];
  entries?: ManagerDeploymentHistoryEntry[];
  source?: string | null;
  timezone?: string;
}

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
  const [periodReferenceTime, setPeriodReferenceTime] = useState(() => Date.now());
  const [period, setPeriod] = useState<ManagerDeploymentHistoryPeriodFilter>(() =>
    parseManagerDeploymentHistoryPeriod(searchParams.get(MANAGER_DEPLOYMENT_HISTORY_QUERY.period)),
  );
  const [status, setStatus] = useState<ManagerDeploymentHistoryStatusFilter>(() =>
    parseManagerDeploymentHistoryStatus(searchParams.get(MANAGER_DEPLOYMENT_HISTORY_QUERY.status)),
  );
  const [stage, setStage] = useState<ManagerDeploymentHistoryStageFilter>(() =>
    parseManagerDeploymentHistoryStage(searchParams.get(MANAGER_DEPLOYMENT_HISTORY_QUERY.stage)),
  );
  const [historySource, setHistorySource] = useState<ManagerDeploymentHistorySourceFilter>(() =>
    parseManagerDeploymentHistorySource(searchParams.get(MANAGER_DEPLOYMENT_HISTORY_QUERY.source)),
  );
  const [searchText, setSearchText] = useState(() =>
    (searchParams.get(MANAGER_DEPLOYMENT_HISTORY_QUERY.search) || "").slice(0, 100),
  );
  const filters: ManagerDeploymentHistoryFilters = {
    period,
    search: searchText,
    source: historySource,
    stage,
    status,
  };
  const normalizedSearchText = searchText.trim().toLowerCase();
  const periodCutoff = period === "all"
    ? null
    : periodReferenceTime - Number(period) * 24 * 60 * 60 * 1_000;
  const visibleEntries = historySource === "archive" ? archiveEntries : entries;
  const filteredEntries = visibleEntries.filter((entry) => {
    const matchesPeriod = periodCutoff === null || Date.parse(entry.completed_at) >= periodCutoff;
    const matchesStatus = status === "all" || entry.status === status;
    const matchesFailureStage = stage === "all"
      || (stage === "unknown"
        ? entry.status !== "success" && !entry.failure_stage
        : entry.failure_stage === stage);
    const matchesSearch = !normalizedSearchText || [entry.version, entry.revision, entry.failure_reason]
      .some((value) => value?.toLowerCase().includes(normalizedSearchText));
    return matchesPeriod && matchesStatus && matchesFailureStage && matchesSearch;
  });

  const updateFilters = (updates: Partial<ManagerDeploymentHistoryFilters>) => {
    const queryUpdates: [key: string, value: string, defaultValue: string][] = [];
    if (updates.period !== undefined) {
      setPeriodReferenceTime(Date.now());
      setPeriod(updates.period);
      queryUpdates.push([MANAGER_DEPLOYMENT_HISTORY_QUERY.period, updates.period, "all"]);
    }
    if (updates.search !== undefined) {
      const nextSearch = updates.search.slice(0, 100);
      setSearchText(nextSearch);
      queryUpdates.push([MANAGER_DEPLOYMENT_HISTORY_QUERY.search, nextSearch, ""]);
    }
    if (updates.source !== undefined) {
      setHistorySource(updates.source);
      queryUpdates.push([MANAGER_DEPLOYMENT_HISTORY_QUERY.source, updates.source, "current"]);
    }
    if (updates.stage !== undefined) {
      setStage(updates.stage);
      queryUpdates.push([MANAGER_DEPLOYMENT_HISTORY_QUERY.stage, updates.stage, "all"]);
    }
    if (updates.status !== undefined) {
      setStatus(updates.status);
      queryUpdates.push([MANAGER_DEPLOYMENT_HISTORY_QUERY.status, updates.status, "all"]);
    }
    replaceManagerDeploymentHistoryQueryParams(queryUpdates);
  };

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

  const handleCopy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setToastNotice({ message: `${label} 복사 완료`, tone: "success" });
    } catch {
      setToastNotice({ message: `${label} 복사 실패`, tone: "error" });
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
        <ManagerDeploymentHistoryControls
          archiveCount={archiveEntries.length}
          entries={visibleEntries}
          filteredCount={filteredEntries.length}
          filters={filters}
          onExport={handleExport}
          onFiltersChange={updateFilters}
        />

        {visibleEntries.length === 0 ? (
          <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">
            {historySource === "archive"
              ? "회전 보관된 배포가 없습니다."
              : "기록된 blue-green 배포가 없습니다."}
          </p>
        ) : filteredEntries.length === 0 ? (
          <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">
            선택한 필터의 배포 이력이 없습니다.
          </p>
        ) : (
          <ol className="mt-3 grid gap-2 lg:grid-cols-2">
            {filteredEntries.map((entry) => (
              <ManagerDeploymentHistoryItem
                entry={entry}
                key={`${entry.completed_at}-${entry.to_slot}`}
                onCopy={handleCopy}
                previousVersion={visibleEntries[visibleEntries.indexOf(entry) + 1]?.version}
                searchText={searchText}
                source={source}
                timezone={timezone}
              />
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
