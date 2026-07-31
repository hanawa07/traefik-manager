"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import {
  DEFAULT_MANAGER_DEPLOYMENT_BOTTLENECK_THRESHOLD,
  MANAGER_DEPLOYMENT_HISTORY_QUERY,
  parseManagerDeploymentArchiveSample,
  parseManagerDeploymentBottleneckThreshold,
  parseManagerDeploymentHistoryDate,
  parseManagerDeploymentHistoryPeriod,
  parseManagerDeploymentHistorySource,
  parseManagerDeploymentHistorySpeed,
  parseManagerDeploymentHistoryStage,
  parseManagerDeploymentHistoryStatus,
  replaceManagerDeploymentHistoryQueryParams,
  type ManagerDeploymentArchiveSampleFilter,
  type ManagerDeploymentHistoryFilters,
  type ManagerDeploymentHistoryPeriodFilter,
  type ManagerDeploymentHistorySourceFilter,
  type ManagerDeploymentHistorySpeedFilter,
  type ManagerDeploymentHistoryStageFilter,
  type ManagerDeploymentHistoryStatusFilter,
} from "./managerDeploymentHistoryQuery";

export function useManagerDeploymentHistoryFilters() {
  const searchParams = useSearchParams();
  const [periodReferenceTime, setPeriodReferenceTime] = useState(() => Date.now());
  const [bottleneckThreshold, setBottleneckThreshold] = useState(() =>
    parseManagerDeploymentBottleneckThreshold(
      searchParams.get(MANAGER_DEPLOYMENT_HISTORY_QUERY.bottleneckThreshold),
    ),
  );
  const [dateFrom, setDateFrom] = useState(() =>
    parseManagerDeploymentHistoryDate(searchParams.get(MANAGER_DEPLOYMENT_HISTORY_QUERY.dateFrom)),
  );
  const [archiveSample, setArchiveSample] = useState<ManagerDeploymentArchiveSampleFilter>(() =>
    parseManagerDeploymentHistorySource(
      searchParams.get(MANAGER_DEPLOYMENT_HISTORY_QUERY.source),
    ) === "current"
      ? "all"
      : parseManagerDeploymentArchiveSample(
          searchParams.get(MANAGER_DEPLOYMENT_HISTORY_QUERY.archiveSample),
        ),
  );
  const [dateTo, setDateTo] = useState(() =>
    parseManagerDeploymentHistoryDate(searchParams.get(MANAGER_DEPLOYMENT_HISTORY_QUERY.dateTo)),
  );
  const [period, setPeriod] = useState<ManagerDeploymentHistoryPeriodFilter>(() =>
    parseManagerDeploymentHistoryPeriod(searchParams.get(MANAGER_DEPLOYMENT_HISTORY_QUERY.period)),
  );
  const [status, setStatus] = useState<ManagerDeploymentHistoryStatusFilter>(() =>
    parseManagerDeploymentHistoryStatus(searchParams.get(MANAGER_DEPLOYMENT_HISTORY_QUERY.status)),
  );
  const [stage, setStage] = useState<ManagerDeploymentHistoryStageFilter>(() =>
    parseManagerDeploymentHistoryStage(searchParams.get(MANAGER_DEPLOYMENT_HISTORY_QUERY.stage)),
  );
  const [source, setSource] = useState<ManagerDeploymentHistorySourceFilter>(() =>
    parseManagerDeploymentHistorySource(searchParams.get(MANAGER_DEPLOYMENT_HISTORY_QUERY.source)),
  );
  const [speed, setSpeed] = useState<ManagerDeploymentHistorySpeedFilter>(() =>
    parseManagerDeploymentHistorySpeed(searchParams.get(MANAGER_DEPLOYMENT_HISTORY_QUERY.speed)),
  );
  const [search, setSearch] = useState(() =>
    (searchParams.get(MANAGER_DEPLOYMENT_HISTORY_QUERY.search) || "").slice(0, 100),
  );
  const filters: ManagerDeploymentHistoryFilters = {
    archiveSample,
    bottleneckThreshold,
    dateFrom,
    dateTo,
    period,
    search,
    source,
    speed,
    stage,
    status,
  };

  const updateFilters = (updates: Partial<ManagerDeploymentHistoryFilters>) => {
    const queryUpdates: [key: string, value: string, defaultValue: string][] = [];
    if (updates.archiveSample !== undefined) {
      setArchiveSample(updates.archiveSample);
      queryUpdates.push([
        MANAGER_DEPLOYMENT_HISTORY_QUERY.archiveSample,
        updates.archiveSample,
        "all",
      ]);
    }
    if (updates.bottleneckThreshold !== undefined) {
      setBottleneckThreshold(updates.bottleneckThreshold);
      queryUpdates.push([
        MANAGER_DEPLOYMENT_HISTORY_QUERY.bottleneckThreshold,
        updates.bottleneckThreshold,
        DEFAULT_MANAGER_DEPLOYMENT_BOTTLENECK_THRESHOLD,
      ]);
    }
    if (updates.dateFrom !== undefined) {
      setDateFrom(updates.dateFrom);
      queryUpdates.push([MANAGER_DEPLOYMENT_HISTORY_QUERY.dateFrom, updates.dateFrom, ""]);
    }
    if (updates.dateTo !== undefined) {
      setDateTo(updates.dateTo);
      queryUpdates.push([MANAGER_DEPLOYMENT_HISTORY_QUERY.dateTo, updates.dateTo, ""]);
    }
    if (updates.period !== undefined) {
      setPeriodReferenceTime(Date.now());
      setPeriod(updates.period);
      queryUpdates.push([MANAGER_DEPLOYMENT_HISTORY_QUERY.period, updates.period, "all"]);
    }
    if (updates.search !== undefined) {
      const nextSearch = updates.search.slice(0, 100);
      setSearch(nextSearch);
      queryUpdates.push([MANAGER_DEPLOYMENT_HISTORY_QUERY.search, nextSearch, ""]);
    }
    if (updates.source !== undefined) {
      setSource(updates.source);
      queryUpdates.push([MANAGER_DEPLOYMENT_HISTORY_QUERY.source, updates.source, "current"]);
      if (updates.source === "current" && updates.archiveSample === undefined) {
        setArchiveSample("all");
        queryUpdates.push([MANAGER_DEPLOYMENT_HISTORY_QUERY.archiveSample, "all", "all"]);
      }
    }
    if (updates.speed !== undefined) {
      setSpeed(updates.speed);
      queryUpdates.push([MANAGER_DEPLOYMENT_HISTORY_QUERY.speed, updates.speed, "all"]);
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

  return { filters, periodReferenceTime, updateFilters };
}
