import type {
  SmokeFailureMetadataEntry,
  SmokeFailureType,
} from "@/features/settings/api/settingsApi";

export type SmokeFailureMetadataTypeFilter = "all" | SmokeFailureType;
export type SmokeFailureMetadataPeriodFilter = "all" | "7" | "30" | "custom";
export type SmokeFailureMetadataSort = "newest" | "oldest" | "run_desc" | "run_asc";
export type SmokeFailureMetadataDatePreset =
  | "today"
  | "yesterday"
  | "this_month"
  | "last_month";

export interface SmokeFailureMetadataDateRange {
  endDate: string;
  startDate: string;
}

export interface SmokeFailureMetadataFilters extends SmokeFailureMetadataDateRange {
  period: SmokeFailureMetadataPeriodFilter;
  query: string;
  sort: SmokeFailureMetadataSort;
  type: SmokeFailureMetadataTypeFilter;
}

export interface SmokeFailureMetadataFilterOptions {
  endDate?: string;
  now?: number;
  query?: string;
  startDate?: string;
  timezone?: string;
}

export const SMOKE_FAILURE_METADATA_QUERY = {
  endDate: "smoke_metadata_to",
  period: "smoke_metadata_period",
  query: "smoke_metadata_q",
  sort: "smoke_metadata_sort",
  startDate: "smoke_metadata_from",
  type: "smoke_metadata_type",
} as const;

export const SMOKE_FAILURE_METADATA_SEARCH_LIMIT = 100;

const DAY_MS = 24 * 60 * 60 * 1000;

export function countSmokeFailureMetadataActiveFilters(
  filters: SmokeFailureMetadataFilters,
): number {
  return [
    filters.type !== "all",
    filters.period !== "all",
    Boolean(filters.query),
    filters.sort !== "newest",
  ].filter(Boolean).length;
}

export function buildSmokeFailureMetadataDatePresetRange(
  preset: SmokeFailureMetadataDatePreset,
  options: Pick<SmokeFailureMetadataFilterOptions, "now" | "timezone"> = {},
): SmokeFailureMetadataDateRange {
  const today = calendarDateInTimezone(options.now ?? Date.now(), options.timezone);
  if (preset === "today") return { endDate: today, startDate: today };
  if (preset === "yesterday") {
    const yesterday = shiftCalendarDate(today, -1);
    return { endDate: yesterday, startDate: yesterday };
  }
  if (preset === "this_month") {
    return { endDate: today, startDate: `${today.slice(0, 7)}-01` };
  }
  const previousMonthEnd = shiftCalendarDate(`${today.slice(0, 7)}-01`, -1);
  return {
    endDate: previousMonthEnd,
    startDate: `${previousMonthEnd.slice(0, 7)}-01`,
  };
}

export function filterSmokeFailureMetadata(
  entries: SmokeFailureMetadataEntry[],
  type: SmokeFailureMetadataTypeFilter,
  period: SmokeFailureMetadataPeriodFilter,
  options: SmokeFailureMetadataFilterOptions = {},
): SmokeFailureMetadataEntry[] {
  const now = options.now ?? Date.now();
  const query = normalizeSmokeFailureMetadataSearch(options.query).trim().toLowerCase();
  const runQuery = query.replace(/^#/, "");
  const cutoff = period === "7" || period === "30" ? now - Number(period) * DAY_MS : null;
  const invalidCustomRange =
    period === "custom" &&
    Boolean(options.startDate && options.endDate && options.startDate > options.endDate);
  if (invalidCustomRange) return [];

  return entries.filter((entry) => {
    if (
      query &&
      !entry.check_name.toLowerCase().includes(query) &&
      !(runQuery && String(entry.run_id).includes(runQuery))
    ) {
      return false;
    }
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

export function sortSmokeFailureMetadata(
  entries: SmokeFailureMetadataEntry[],
  sort: SmokeFailureMetadataSort,
): SmokeFailureMetadataEntry[] {
  return [...entries].sort((left, right) => {
    if (sort === "run_desc") return right.run_id - left.run_id;
    if (sort === "run_asc") return left.run_id - right.run_id;
    const leftTime = Date.parse(left.captured_at);
    const rightTime = Date.parse(right.captured_at);
    const leftValid = Number.isFinite(leftTime);
    const rightValid = Number.isFinite(rightTime);
    if (!leftValid || !rightValid) {
      if (leftValid) return -1;
      if (rightValid) return 1;
      return right.run_id - left.run_id;
    }
    if (leftTime === rightTime) return right.run_id - left.run_id;
    return sort === "oldest" ? leftTime - rightTime : rightTime - leftTime;
  });
}

export function parseSmokeFailureMetadataFilters(
  search: string,
): SmokeFailureMetadataFilters {
  const params = new URLSearchParams(search);
  const periodValue = params.get(SMOKE_FAILURE_METADATA_QUERY.period);
  const sortValue = params.get(SMOKE_FAILURE_METADATA_QUERY.sort);
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
    query: normalizeSmokeFailureMetadataSearch(
      params.get(SMOKE_FAILURE_METADATA_QUERY.query),
    ),
    sort:
      sortValue === "oldest" || sortValue === "run_desc" || sortValue === "run_asc"
        ? sortValue
        : "newest",
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

function normalizeSmokeFailureMetadataSearch(value: unknown): string {
  return typeof value === "string"
    ? value.slice(0, SMOKE_FAILURE_METADATA_SEARCH_LIMIT)
    : "";
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

function shiftCalendarDate(value: string, days: number): string {
  const timestamp = Date.parse(`${value}T00:00:00Z`) + days * DAY_MS;
  return new Date(timestamp).toISOString().slice(0, 10);
}
