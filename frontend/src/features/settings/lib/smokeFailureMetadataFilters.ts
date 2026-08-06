import type {
  SmokeFailureMetadataEntry,
  SmokeFailureType,
} from "@/features/settings/api/settingsApi";

export type SmokeFailureMetadataTypeFilter = "all" | SmokeFailureType;
export type SmokeFailureMetadataPeriodFilter = "all" | "7" | "30";

export const SMOKE_FAILURE_METADATA_QUERY = {
  period: "smoke_metadata_period",
  type: "smoke_metadata_type",
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export function filterSmokeFailureMetadata(
  entries: SmokeFailureMetadataEntry[],
  type: SmokeFailureMetadataTypeFilter,
  period: SmokeFailureMetadataPeriodFilter,
  now = Date.now(),
): SmokeFailureMetadataEntry[] {
  const cutoff = period === "all" ? null : now - Number(period) * DAY_MS;
  return entries.filter((entry) => {
    if (type !== "all" && entry.failure_type !== type) return false;
    if (cutoff === null) return true;
    const capturedAt = Date.parse(entry.captured_at);
    return Number.isFinite(capturedAt) && capturedAt >= cutoff && capturedAt <= now;
  });
}

export function parseSmokeFailureMetadataFilters(search: string): {
  period: SmokeFailureMetadataPeriodFilter;
  type: SmokeFailureMetadataTypeFilter;
} {
  const params = new URLSearchParams(search);
  const period = params.get(SMOKE_FAILURE_METADATA_QUERY.period);
  const type = params.get(SMOKE_FAILURE_METADATA_QUERY.type);
  return {
    period: period === "7" || period === "30" ? period : "all",
    type:
      type === "login" || type === "external_api" || type === "visual_regression"
        ? type
        : "all",
  };
}
