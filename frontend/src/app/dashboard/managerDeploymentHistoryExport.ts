import type { ManagerDeploymentHistoryEntry } from "@/features/deployment/api/deploymentApi";

import type {
  ManagerDeploymentHistoryFilters,
  ManagerDeploymentHistoryRecordSource,
} from "./managerDeploymentHistoryQuery";

export type ManagerDeploymentHistoryExportFormat = "csv" | "json";
type ManagerDeploymentHistoryExportEntry = ManagerDeploymentHistoryEntry & {
  source?: ManagerDeploymentHistoryRecordSource;
};
type ManagerDeploymentHistoryExportColumn = keyof ManagerDeploymentHistoryExportEntry;
interface ManagerDeploymentHistoryExportMetadata {
  exported_at: string;
  filters: {
    date_from: string | null;
    date_to: string | null;
    failure_stage: ManagerDeploymentHistoryFilters["stage"];
    period: ManagerDeploymentHistoryFilters["period"];
    search: string | null;
    source: ManagerDeploymentHistoryFilters["source"];
    status: ManagerDeploymentHistoryFilters["status"];
  };
  result_count: number;
  schema_version: 1;
  timezone: string;
}

const CSV_COLUMNS: readonly (keyof ManagerDeploymentHistoryEntry)[] = [
  "status",
  "from_slot",
  "to_slot",
  "active_slot",
  "version",
  "revision",
  "started_at",
  "completed_at",
  "probe_total",
  "probe_failures",
  "failure_stage",
  "failure_reason",
  "alert_request_status",
  "alert_run_url",
  "alert_run_status",
  "alert_run_conclusion",
  "alert_run_checked_at",
  "alert_run_error",
];

export function downloadManagerDeploymentHistory(
  entries: ManagerDeploymentHistoryEntry[],
  filters: ManagerDeploymentHistoryFilters,
  format: ManagerDeploymentHistoryExportFormat,
  resolveSource?: (entry: ManagerDeploymentHistoryEntry) => ManagerDeploymentHistoryRecordSource,
  timezone?: string,
): string {
  const source = filters.source;
  if (source === "all" && !resolveSource) {
    throw new Error("통합 배포 이력 source 확인 함수가 필요합니다.");
  }
  const includeSource = source === "all";
  const exportEntries: ManagerDeploymentHistoryExportEntry[] = includeSource
    ? entries.map((entry) => ({ source: resolveSource!(entry), ...entry }))
    : entries;
  const metadata = buildMetadata(filters, entries.length, timezone);
  const content = format === "csv"
    ? `\uFEFF${toCsv(metadata, exportEntries, includeSource)}`
    : JSON.stringify({ metadata, entries: exportEntries }, null, 2);
  const blob = new Blob([content], {
    type: format === "csv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const period = filters.dateFrom || filters.dateTo
    ? `${filters.dateFrom || "start"}_to_${filters.dateTo || "end"}`
    : filters.period === "all" ? "all-time" : `${filters.period}d`;
  link.download = `traefik-manager-deployments-${source}-${period}-${filters.status}-${metadata.exported_at.slice(0, 10)}.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return link.download;
}

function buildMetadata(
  filters: ManagerDeploymentHistoryFilters,
  resultCount: number,
  timezone?: string,
): ManagerDeploymentHistoryExportMetadata {
  return {
    exported_at: new Date().toISOString(),
    filters: {
      date_from: filters.dateFrom || null,
      date_to: filters.dateTo || null,
      failure_stage: filters.stage,
      period: filters.period,
      search: filters.search.trim() || null,
      source: filters.source,
      status: filters.status,
    },
    result_count: resultCount,
    schema_version: 1,
    timezone: timezone?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  };
}

function toCsv(
  metadata: ManagerDeploymentHistoryExportMetadata,
  entries: ManagerDeploymentHistoryExportEntry[],
  includeSource: boolean,
): string {
  const columns: readonly ManagerDeploymentHistoryExportColumn[] = includeSource
    ? ["source", ...CSV_COLUMNS]
    : CSV_COLUMNS;
  const metadataRows = [
    ["schema_version", metadata.schema_version],
    ["exported_at", metadata.exported_at],
    ["timezone", metadata.timezone],
    ["result_count", metadata.result_count],
    ["filter_source", metadata.filters.source],
    ["filter_period", metadata.filters.period],
    ["filter_date_from", metadata.filters.date_from],
    ["filter_date_to", metadata.filters.date_to],
    ["filter_status", metadata.filters.status],
    ["filter_failure_stage", metadata.filters.failure_stage],
    ["filter_search", metadata.filters.search],
  ] as const;
  return [
    "metadata,value",
    ...metadataRows.map(([key, value]) => `${key},${csvCell(value)}`),
    "",
    columns.join(","),
    ...entries.map((entry) => columns.map((column) => csvCell(entry[column])).join(",")),
  ].join("\r\n");
}

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  const safe = /^[=+\-@\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
