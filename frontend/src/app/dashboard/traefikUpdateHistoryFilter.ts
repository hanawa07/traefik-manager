import type { TraefikUpdateHistoryEntry } from "@/features/traefik/api/traefikApi";

export type TraefikUpdateHistoryPeriod = "all" | "1" | "7" | "30" | "90";
export type TraefikUpdateHistoryRetry = "all" | "retried" | "not_retried";
export type TraefikUpdateHistoryStatus = "all" | TraefikUpdateHistoryEntry["status"];

export interface TraefikUpdateHistoryFilters {
  actor: string;
  dateFrom: string;
  dateTo: string;
  period: TraefikUpdateHistoryPeriod;
  retry: TraefikUpdateHistoryRetry;
  status: TraefikUpdateHistoryStatus;
}

interface QueryReader {
  get(key: string): string | null;
}

const DAY_MS = 24 * 60 * 60 * 1_000;

export const DEFAULT_TRAEFIK_UPDATE_HISTORY_FILTERS: TraefikUpdateHistoryFilters = {
  actor: "",
  dateFrom: "",
  dateTo: "",
  period: "all",
  retry: "all",
  status: "all",
};

export const TRAEFIK_UPDATE_HISTORY_QUERY = {
  actor: "traefik_update_actor",
  dateFrom: "traefik_update_from",
  dateTo: "traefik_update_to",
  period: "traefik_update_period",
  retry: "traefik_update_retry",
  status: "traefik_update_status",
} as const;

export function readTraefikUpdateHistoryFilters(
  params: QueryReader,
): TraefikUpdateHistoryFilters {
  const dateFrom = parseDate(params.get(TRAEFIK_UPDATE_HISTORY_QUERY.dateFrom));
  const dateTo = parseDate(params.get(TRAEFIK_UPDATE_HISTORY_QUERY.dateTo));
  return {
    actor: (params.get(TRAEFIK_UPDATE_HISTORY_QUERY.actor) || "").trim().slice(0, 100),
    dateFrom,
    dateTo,
    period: dateFrom || dateTo
      ? "all"
      : parsePeriod(params.get(TRAEFIK_UPDATE_HISTORY_QUERY.period)),
    retry: parseRetry(params.get(TRAEFIK_UPDATE_HISTORY_QUERY.retry)),
    status: parseStatus(params.get(TRAEFIK_UPDATE_HISTORY_QUERY.status)),
  };
}

export function replaceTraefikUpdateHistoryQuery(
  filters: TraefikUpdateHistoryFilters,
): void {
  const url = new URL(window.location.href);
  const values = [
    [TRAEFIK_UPDATE_HISTORY_QUERY.actor, filters.actor.trim(), ""],
    [TRAEFIK_UPDATE_HISTORY_QUERY.dateFrom, filters.dateFrom, ""],
    [TRAEFIK_UPDATE_HISTORY_QUERY.dateTo, filters.dateTo, ""],
    [TRAEFIK_UPDATE_HISTORY_QUERY.period, filters.period, "all"],
    [TRAEFIK_UPDATE_HISTORY_QUERY.retry, filters.retry, "all"],
    [TRAEFIK_UPDATE_HISTORY_QUERY.status, filters.status, "all"],
  ] as const;
  values.forEach(([key, value, defaultValue]) => {
    if (value === defaultValue) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  });
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", nextUrl);
}

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
  const actor = filters.actor.trim().toLowerCase();

  return entries.filter((entry) => {
    if (filters.status !== "all" && entry.status !== filters.status) return false;
    if (
      actor
      && !entry.actor.toLowerCase().includes(actor)
      && !entry.alert_retry_actor?.toLowerCase().includes(actor)
    ) return false;
    const retried = Boolean(entry.alert_retry_requested_at);
    if (filters.retry === "retried" && !retried) return false;
    if (filters.retry === "not_retried" && retried) return false;
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

function parseDate(value: string | null): string {
  return value && getDateBoundary(value) !== null ? value : "";
}

function parsePeriod(value: string | null): TraefikUpdateHistoryPeriod {
  return value === "1" || value === "7" || value === "30" || value === "90"
    ? value
    : "all";
}

function parseRetry(value: string | null): TraefikUpdateHistoryRetry {
  return value === "retried" || value === "not_retried" ? value : "all";
}

function parseStatus(value: string | null): TraefikUpdateHistoryStatus {
  return value === "running"
    || value === "success"
    || value === "rejected"
    || value === "rolled_back"
    || value === "rollback_failed"
    ? value
    : "all";
}
