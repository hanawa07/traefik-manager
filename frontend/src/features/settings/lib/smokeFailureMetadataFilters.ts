import type {
  SmokeFailureMetadataEntry,
  SmokeFailureType,
} from "@/features/settings/api/settingsApi";

export type SmokeFailureMetadataTypeFilter = "all" | SmokeFailureType;
export type SmokeFailureMetadataPeriodFilter = "all" | "7" | "30";

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
