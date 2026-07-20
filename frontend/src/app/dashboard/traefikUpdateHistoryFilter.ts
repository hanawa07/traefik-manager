import type { TraefikUpdateHistoryEntry } from "@/features/traefik/api/traefikApi";

export type TraefikUpdateHistoryPeriod = "all" | "1" | "7" | "30" | "90";
export type TraefikUpdateHistoryStatus = "all" | TraefikUpdateHistoryEntry["status"];

export interface TraefikUpdateHistoryFilters {
  dateFrom: string;
  dateTo: string;
  period: TraefikUpdateHistoryPeriod;
  status: TraefikUpdateHistoryStatus;
}

const DAY_MS = 24 * 60 * 60 * 1_000;

export const DEFAULT_TRAEFIK_UPDATE_HISTORY_FILTERS: TraefikUpdateHistoryFilters = {
  dateFrom: "",
  dateTo: "",
  period: "all",
  status: "all",
};

export function filterTraefikUpdateHistory(
  entries: TraefikUpdateHistoryEntry[],
  filters: TraefikUpdateHistoryFilters,
  referenceTime = Date.now(),
): TraefikUpdateHistoryEntry[] {
  if (!isTraefikUpdateHistoryDateRangeValid(filters)) return [];
  const periodCutoff = filters.period === "all"
    ? null
    : referenceTime - Number(filters.period) * DAY_MS;
  const dateFrom = getDateBoundary(filters.dateFrom);
  const dateTo = getDateBoundary(filters.dateTo, true);
  const hasTimeFilter = periodCutoff !== null || dateFrom !== null || dateTo !== null;

  return entries.filter((entry) => {
    if (filters.status !== "all" && entry.status !== filters.status) return false;
    if (!hasTimeFilter) return true;
    const occurredAt = Date.parse(entry.completed_at || entry.started_at);
    return Number.isFinite(occurredAt)
      && (periodCutoff === null || occurredAt >= periodCutoff)
      && (dateFrom === null || occurredAt >= dateFrom)
      && (dateTo === null || occurredAt < dateTo);
  });
}

export function isTraefikUpdateHistoryDateRangeValid(
  filters: Pick<TraefikUpdateHistoryFilters, "dateFrom" | "dateTo">,
): boolean {
  const dateFrom = getDateBoundary(filters.dateFrom);
  const dateTo = getDateBoundary(filters.dateTo, true);
  if ((filters.dateFrom && dateFrom === null) || (filters.dateTo && dateTo === null)) return false;
  return dateFrom === null || dateTo === null || dateFrom < dateTo;
}

function getDateBoundary(value: string, nextDay = false): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const boundary = new Date(year, month - 1, day);
  if (
    boundary.getFullYear() !== year
    || boundary.getMonth() !== month - 1
    || boundary.getDate() !== day
  ) return null;
  if (nextDay) boundary.setDate(boundary.getDate() + 1);
  return boundary.getTime();
}
