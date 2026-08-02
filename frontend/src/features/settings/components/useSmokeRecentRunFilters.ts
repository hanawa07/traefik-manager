"use client";

import { useEffect, useState } from "react";

import {
  type SmokeHistoryDays,
  type SmokeHistoryStatus,
  type SmokeRotationStatus,
} from "@/features/settings/api/settingsApi";

export function useSmokeRecentRunFilters(initialStatus: SmokeRotationStatus) {
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [runStatus, setRunStatus] = useState<SmokeHistoryStatus>("all");
  const [days, setDays] = useState<SmokeHistoryDays>(initialStatus.monitoring_history_days ?? 30);
  const [page, setPage] = useState(initialStatus.monitoring_history_page ?? 1);
  const [filtersRestored, setFiltersRestored] = useState(false);

  useEffect(() => {
    const filters = readHistoryFilters();
    setSearch(filters.search);
    setAppliedSearch(filters.search);
    setRunStatus(filters.status);
    setDays(filters.days);
    setPage(filters.page);
    setFiltersRestored(true);
  }, []);

  const applySearch = () => {
    const value = search.trim();
    setSearch(value);
    setAppliedSearch(value);
    setPage(1);
    replaceHistoryUrl({ smoke_page: null, smoke_search: value || null });
  };
  const changeStatus = (value: SmokeHistoryStatus) => {
    const nextSearch = search.trim();
    setSearch(nextSearch);
    setAppliedSearch(nextSearch);
    setRunStatus(value);
    setPage(1);
    replaceHistoryUrl({
      smoke_page: null,
      smoke_search: nextSearch || null,
      smoke_status: value === "all" ? null : value,
    });
  };
  const changeDays = (value: SmokeHistoryDays) => {
    const nextSearch = search.trim();
    setSearch(nextSearch);
    setAppliedSearch(nextSearch);
    setDays(value);
    setPage(1);
    replaceHistoryUrl({
      smoke_days: value === 30 ? null : String(value),
      smoke_page: null,
      smoke_search: nextSearch || null,
    });
  };
  const changePage = (value: number) => {
    setPage(value);
    replaceHistoryUrl({ smoke_page: value === 1 ? null : String(value) });
  };
  const resetFilters = () => {
    setSearch("");
    setAppliedSearch("");
    setRunStatus("all");
    setDays(30);
    setPage(1);
    replaceHistoryUrl({
      smoke_days: null,
      smoke_page: null,
      smoke_search: null,
      smoke_status: null,
    });
  };

  return {
    search,
    setSearch,
    appliedSearch,
    runStatus,
    days,
    page,
    filtersRestored,
    filtersAreDefault:
      search === "" && appliedSearch === "" && runStatus === "all" && days === 30 && page === 1,
    applySearch,
    changeStatus,
    changeDays,
    changePage,
    resetFilters,
  };
}

function readHistoryFilters(): {
  search: string;
  status: SmokeHistoryStatus;
  days: SmokeHistoryDays;
  page: number;
} {
  const params = new URLSearchParams(window.location.search);
  const status = params.get("smoke_status");
  const days = Number(params.get("smoke_days"));
  const page = Number(params.get("smoke_page"));
  return {
    search: (params.get("smoke_search") || "").slice(0, 100),
    status:
      status === "success" || status === "failure" || status === "cancelled"
        ? status
        : "all",
    days: days === 7 ? 7 : 30,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

function replaceHistoryUrl(updates: Record<string, string | null>): void {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(updates)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}
