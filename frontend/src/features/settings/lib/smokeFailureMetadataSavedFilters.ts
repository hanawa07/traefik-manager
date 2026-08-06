import type {
  SmokeFailureMetadataFilters,
  SmokeFailureMetadataPeriodFilter,
  SmokeFailureMetadataSort,
  SmokeFailureMetadataTypeFilter,
} from "@/features/settings/lib/smokeFailureMetadataFilters";

export const SMOKE_FAILURE_METADATA_SAVED_FILTERS_STORAGE_KEY =
  "traefik-manager:smoke-failure-metadata-saved-filters";
export const SMOKE_FAILURE_METADATA_SAVED_FILTER_LIMIT = 20;
export const SMOKE_FAILURE_METADATA_SAVED_FILTER_NAME_LIMIT = 40;

export type SmokeFailureMetadataSavedFilterSort =
  | "recent"
  | "name_asc"
  | "name_desc";

export interface SmokeFailureMetadataSavedFilter {
  filters: SmokeFailureMetadataFilters;
  name: string;
}

export function normalizeSmokeFailureMetadataSavedFilterName(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, SMOKE_FAILURE_METADATA_SAVED_FILTER_NAME_LIMIT);
}

export function parseSmokeFailureMetadataSavedFilters(
  rawValue: string | null,
): SmokeFailureMetadataSavedFilter[] {
  if (!rawValue) return [];
  try {
    const value: unknown = JSON.parse(rawValue);
    if (!Array.isArray(value)) return [];
    const result: SmokeFailureMetadataSavedFilter[] = [];
    const names = new Set<string>();
    for (const item of value) {
      if (!isRecord(item)) continue;
      const name = normalizeSmokeFailureMetadataSavedFilterName(
        typeof item.name === "string" ? item.name : "",
      );
      const normalizedName = name.toLowerCase();
      if (!name || names.has(normalizedName)) continue;
      result.push({ filters: normalizeFilters(item.filters), name });
      names.add(normalizedName);
      if (result.length === SMOKE_FAILURE_METADATA_SAVED_FILTER_LIMIT) break;
    }
    return result;
  } catch {
    return [];
  }
}

export function upsertSmokeFailureMetadataSavedFilter(
  current: SmokeFailureMetadataSavedFilter[],
  next: SmokeFailureMetadataSavedFilter,
): SmokeFailureMetadataSavedFilter[] {
  const name = normalizeSmokeFailureMetadataSavedFilterName(next.name);
  if (!name) return current;
  const normalizedName = name.toLowerCase();
  return [
    { filters: normalizeFilters(next.filters), name },
    ...current.filter(
      (item) => item.name.toLowerCase() !== normalizedName,
    ),
  ].slice(0, SMOKE_FAILURE_METADATA_SAVED_FILTER_LIMIT);
}

export function removeSmokeFailureMetadataSavedFilter(
  current: SmokeFailureMetadataSavedFilter[],
  name: string,
): SmokeFailureMetadataSavedFilter[] {
  const normalizedName = normalizeSmokeFailureMetadataSavedFilterName(name).toLowerCase();
  return current.filter((item) => item.name.toLowerCase() !== normalizedName);
}

export function renameSmokeFailureMetadataSavedFilter(
  current: SmokeFailureMetadataSavedFilter[],
  currentName: string,
  nextName: string,
): SmokeFailureMetadataSavedFilter[] {
  const currentKey = normalizeSmokeFailureMetadataSavedFilterName(currentName).toLowerCase();
  const normalizedNextName = normalizeSmokeFailureMetadataSavedFilterName(nextName);
  const nextKey = normalizedNextName.toLowerCase();
  if (!currentKey || !nextKey) return current;
  if (
    currentKey !== nextKey &&
    current.some((item) => item.name.toLowerCase() === nextKey)
  ) {
    return current;
  }
  return current.map((item) =>
    item.name.toLowerCase() === currentKey
      ? { ...item, name: normalizedNextName }
      : item,
  );
}

export function sortSmokeFailureMetadataSavedFilters(
  current: SmokeFailureMetadataSavedFilter[],
  sort: SmokeFailureMetadataSavedFilterSort,
): SmokeFailureMetadataSavedFilter[] {
  if (sort === "recent") return [...current];
  const direction = sort === "name_asc" ? 1 : -1;
  return [...current].sort(
    (left, right) => direction * left.name.localeCompare(right.name, "ko"),
  );
}

function normalizeFilters(value: unknown): SmokeFailureMetadataFilters {
  const filters = isRecord(value) ? value : {};
  const period = isPeriod(filters.period) ? filters.period : "all";
  return {
    endDate: period === "custom" ? normalizeCalendarDate(filters.endDate) : "",
    period,
    query: typeof filters.query === "string" ? filters.query.slice(0, 100) : "",
    sort: isSort(filters.sort) ? filters.sort : "newest",
    startDate: period === "custom" ? normalizeCalendarDate(filters.startDate) : "",
    type: isType(filters.type) ? filters.type : "all",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPeriod(value: unknown): value is SmokeFailureMetadataPeriodFilter {
  return value === "all" || value === "7" || value === "30" || value === "custom";
}

function isSort(value: unknown): value is SmokeFailureMetadataSort {
  return value === "newest" || value === "oldest" || value === "run_desc" || value === "run_asc";
}

function isType(value: unknown): value is SmokeFailureMetadataTypeFilter {
  return value === "all" || value === "login" || value === "external_api" || value === "visual_regression";
}

function normalizeCalendarDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
    ? value
    : "";
}
