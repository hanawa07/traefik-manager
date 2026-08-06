"use client";

import { useEffect, useState } from "react";

import {
  parseSmokeFailureMetadataFilters,
  SMOKE_FAILURE_METADATA_QUERY,
  type SmokeFailureMetadataPeriodFilter,
  type SmokeFailureMetadataSort,
  type SmokeFailureMetadataTypeFilter,
} from "@/features/settings/lib/smokeFailureMetadataFilters";
import { replaceBrowserQueryParams } from "@/shared/lib/replaceBrowserQueryParams";

export function useSmokeFailureMetadataFilters() {
  const [typeFilter, setTypeFilter] = useState<SmokeFailureMetadataTypeFilter>("all");
  const [periodFilter, setPeriodFilter] =
    useState<SmokeFailureMetadataPeriodFilter>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sort, setSort] = useState<SmokeFailureMetadataSort>("newest");

  useEffect(() => {
    const filters = parseSmokeFailureMetadataFilters(window.location.search);
    setTypeFilter(filters.type);
    setPeriodFilter(filters.period);
    setStartDate(filters.startDate);
    setEndDate(filters.endDate);
    setSort(filters.sort);
  }, []);

  const changeTypeFilter = (value: SmokeFailureMetadataTypeFilter) => {
    setTypeFilter(value);
    replaceBrowserQueryParams([[SMOKE_FAILURE_METADATA_QUERY.type, value, "all"]]);
  };
  const changePeriodFilter = (value: SmokeFailureMetadataPeriodFilter) => {
    setPeriodFilter(value);
    replaceBrowserQueryParams([
      [SMOKE_FAILURE_METADATA_QUERY.period, value, "all"],
      [SMOKE_FAILURE_METADATA_QUERY.startDate, value === "custom" ? startDate : "", ""],
      [SMOKE_FAILURE_METADATA_QUERY.endDate, value === "custom" ? endDate : "", ""],
    ]);
  };
  const changeStartDate = (value: string) => {
    setStartDate(value);
    replaceBrowserQueryParams([[SMOKE_FAILURE_METADATA_QUERY.startDate, value, ""]]);
  };
  const changeEndDate = (value: string) => {
    setEndDate(value);
    replaceBrowserQueryParams([[SMOKE_FAILURE_METADATA_QUERY.endDate, value, ""]]);
  };
  const changeSort = (value: SmokeFailureMetadataSort) => {
    setSort(value);
    replaceBrowserQueryParams([[SMOKE_FAILURE_METADATA_QUERY.sort, value, "newest"]]);
  };
  const changeDateRange = (nextStartDate: string, nextEndDate: string) => {
    setPeriodFilter("custom");
    setStartDate(nextStartDate);
    setEndDate(nextEndDate);
    replaceBrowserQueryParams([
      [SMOKE_FAILURE_METADATA_QUERY.period, "custom", "all"],
      [SMOKE_FAILURE_METADATA_QUERY.startDate, nextStartDate, ""],
      [SMOKE_FAILURE_METADATA_QUERY.endDate, nextEndDate, ""],
    ]);
  };

  return {
    changeDateRange,
    changeEndDate,
    changePeriodFilter,
    changeStartDate,
    changeSort,
    changeTypeFilter,
    endDate,
    periodFilter,
    sort,
    startDate,
    typeFilter,
  };
}
