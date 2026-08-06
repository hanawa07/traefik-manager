import type {
  SmokeFailureMetadataEntry,
  SmokeFailureType,
} from "@/features/settings/api/settingsApi";

export type SmokeFailureMetadataTypeFilter = "all" | SmokeFailureType;
export type SmokeFailureMetadataPeriodFilter = "all" | "7" | "30" | "custom";

export interface SmokeFailureMetadataFilterOptions {
  endDate?: string;
  now?: number;
  startDate?: string;
  timezone?: string;
}

export const SMOKE_FAILURE_METADATA_QUERY = {
  endDate: "smoke_metadata_to",
  period: "smoke_metadata_period",
  startDate: "smoke_metadata_from",
  type: "smoke_metadata_type",
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export function filterSmokeFailureMetadata(
  entries: SmokeFailureMetadataEntry[],
  type: SmokeFailureMetadataTypeFilter,
  period: SmokeFailureMetadataPeriodFilter,
  options: SmokeFailureMetadataFilterOptions = {},
): SmokeFailureMetadataEntry[] {
  const now = options.now ?? Date.now();
  const cutoff = period === "7" || period === "30" ? now - Number(period) * DAY_MS : null;
  const invalidCustomRange =
    period === "custom" &&
    Boolean(options.startDate && options.endDate && options.startDate > options.endDate);
  if (invalidCustomRange) return [];

  return entries.filter((entry) => {
    if (type !== "all" && entry.failure_type !== type) return false;
    if (period === "all") return true;
    const capturedAt = Date.parse(entry.captured_at);
    if (!Number.isFinite(capturedAt)) return false;
    if (cutoff !== null) return capturedAt >= cutoff && capturedAt <= now;
    const capturedOn = calendarDateInTimezone(capturedAt, options.timezone);
    return (
      (!options.startDate || capturedOn >= options.startDate) &&
      (!options.endDate || capturedOn <= options.endDate)
    );
  });
}

export function parseSmokeFailureMetadataFilters(search: string): {
  endDate: string;
  period: SmokeFailureMetadataPeriodFilter;
  startDate: string;
  type: SmokeFailureMetadataTypeFilter;
} {
  const params = new URLSearchParams(search);
  const periodValue = params.get(SMOKE_FAILURE_METADATA_QUERY.period);
  const type = params.get(SMOKE_FAILURE_METADATA_QUERY.type);
  const period =
    periodValue === "7" || periodValue === "30" || periodValue === "custom"
      ? periodValue
      : "all";
  return {
    endDate:
      period === "custom"
        ? normalizeCalendarDate(params.get(SMOKE_FAILURE_METADATA_QUERY.endDate))
        : "",
    period,
    startDate:
      period === "custom"
        ? normalizeCalendarDate(params.get(SMOKE_FAILURE_METADATA_QUERY.startDate))
        : "",
    type:
      type === "login" || type === "external_api" || type === "visual_regression"
        ? type
        : "all",
  };
}

function normalizeCalendarDate(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
    ? value
    : "";
}

function calendarDateInTimezone(timestamp: number, timezone?: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "2-digit",
      timeZone: timezone,
      year: "numeric",
    }).formatToParts(timestamp);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return new Date(timestamp).toISOString().slice(0, 10);
  }
}
