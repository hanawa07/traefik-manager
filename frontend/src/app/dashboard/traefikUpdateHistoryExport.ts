import type { TraefikUpdateHistoryEntry } from "@/features/traefik/api/traefikApi";

import type { TraefikUpdateHistoryFilters } from "./traefikUpdateHistoryFilter";

export type TraefikUpdateHistoryExportFormat = "csv" | "json";

const CSV_COLUMNS: readonly (keyof TraefikUpdateHistoryEntry)[] = [
  "request_id",
  "actor",
  "status",
  "from_version",
  "target_version",
  "requested_at",
  "started_at",
  "completed_at",
  "message",
  "backup_dir",
  "backup_created",
  "rollback_performed",
  "validations",
];

export function buildTraefikUpdateHistoryExport(
  entries: TraefikUpdateHistoryEntry[],
  filters: TraefikUpdateHistoryFilters,
  format: TraefikUpdateHistoryExportFormat,
  timezone?: string,
  exportedAt = new Date().toISOString(),
): { content: string; filename: string } {
  const metadata = {
    exported_at: exportedAt,
    filters: {
      date_from: filters.dateFrom || null,
      date_to: filters.dateTo || null,
      period: filters.period,
      status: filters.status,
    },
    result_count: entries.length,
    schema_version: 1,
    timezone: timezone?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  };
  const period = filters.dateFrom || filters.dateTo
    ? `${filters.dateFrom || "start"}-to-${filters.dateTo || "end"}`
    : filters.period === "all" ? "all-time" : `${filters.period}d`;
  const filename = `traefik-updates-${filters.status}-${period}-${exportedAt.slice(0, 10)}.${format}`;
  if (format === "json") {
    return { content: JSON.stringify({ metadata, entries }, null, 2), filename };
  }
  const metadataRows = [
    ["schema_version", metadata.schema_version],
    ["exported_at", metadata.exported_at],
    ["timezone", metadata.timezone],
    ["result_count", metadata.result_count],
    ["filter_status", metadata.filters.status],
    ["filter_period", metadata.filters.period],
    ["filter_date_from", metadata.filters.date_from],
    ["filter_date_to", metadata.filters.date_to],
  ] as const;
  const content = [
    "metadata,value",
    ...metadataRows.map(([key, value]) => `${key},${csvCell(value)}`),
    "",
    CSV_COLUMNS.join(","),
    ...entries.map((entry) => CSV_COLUMNS.map((column) => csvCell(entry[column])).join(",")),
  ].join("\r\n");
  return { content: `\uFEFF${content}`, filename };
}

export function downloadTraefikUpdateHistory(
  entries: TraefikUpdateHistoryEntry[],
  filters: TraefikUpdateHistoryFilters,
  format: TraefikUpdateHistoryExportFormat,
  timezone?: string,
): string {
  const { content, filename } = buildTraefikUpdateHistoryExport(
    entries,
    filters,
    format,
    timezone,
  );
  const blob = new Blob([content], {
    type: format === "csv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return filename;
}

function csvCell(value: unknown): string {
  const text = value == null
    ? ""
    : typeof value === "object" ? JSON.stringify(value) : String(value);
  const safe = /^[=+\-@\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
