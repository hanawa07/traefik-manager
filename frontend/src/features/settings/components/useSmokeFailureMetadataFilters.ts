"use client";

import { useEffect, useState } from "react";

import {
  parseSmokeFailureMetadataFilters,
  SMOKE_FAILURE_METADATA_QUERY,
  type SmokeFailureMetadataPeriodFilter,
  type SmokeFailureMetadataTypeFilter,
} from "@/features/settings/lib/smokeFailureMetadataFilters";
import { replaceBrowserQueryParams } from "@/shared/lib/replaceBrowserQueryParams";

export function useSmokeFailureMetadataFilters() {
  const [typeFilter, setTypeFilter] = useState<SmokeFailureMetadataTypeFilter>("all");
  const [periodFilter, setPeriodFilter] =
    useState<SmokeFailureMetadataPeriodFilter>("all");

  useEffect(() => {
    const filters = parseSmokeFailureMetadataFilters(window.location.search);
    setTypeFilter(filters.type);
    setPeriodFilter(filters.period);
  }, []);

  const changeTypeFilter = (value: SmokeFailureMetadataTypeFilter) => {
    setTypeFilter(value);
    replaceBrowserQueryParams([[SMOKE_FAILURE_METADATA_QUERY.type, value, "all"]]);
  };
  const changePeriodFilter = (value: SmokeFailureMetadataPeriodFilter) => {
    setPeriodFilter(value);
    replaceBrowserQueryParams([[SMOKE_FAILURE_METADATA_QUERY.period, value, "all"]]);
  };

  return {
    changePeriodFilter,
    changeTypeFilter,
    periodFilter,
    typeFilter,
  };
}
