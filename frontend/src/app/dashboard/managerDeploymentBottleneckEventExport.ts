import type { ManagerDeploymentBottleneckEvent } from "@/features/deployment/api/deploymentApi";

export type ManagerDeploymentBottleneckEventExportFormat = "csv" | "json";
export type ManagerDeploymentBottleneckEventFilter = "all" | "alerted" | "cleared";
export type ManagerDeploymentBottleneckEventPeriod = "all" | "1" | "7" | "30";

interface ManagerDeploymentBottleneckEventExportFilters {
  event: ManagerDeploymentBottleneckEventFilter;
  period: ManagerDeploymentBottleneckEventPeriod;
}

interface ManagerDeploymentBottleneckEventExportMetadata {
  exported_at: string;
  filters: ManagerDeploymentBottleneckEventExportFilters;
  result_count: number;
  schema_version: 1;
  timezone: string;
}

const CSV_COLUMNS: readonly (keyof ManagerDeploymentBottleneckEvent)[] = [
  "event",
  "occurred_at",
  "threshold_ms",
  "required_consecutive_count",
  "current_consecutive_count",
  "latest_version",
  "slowest_stage",
  "slowest_ms",
  "run_url",
];

export function downloadManagerDeploymentBottleneckEvents(
  events: ManagerDeploymentBottleneckEvent[],
  filters: ManagerDeploymentBottleneckEventExportFilters,
  format: ManagerDeploymentBottleneckEventExportFormat,
  timezone?: string,
): string {
  const metadata: ManagerDeploymentBottleneckEventExportMetadata = {
    exported_at: new Date().toISOString(),
    filters,
    result_count: events.length,
    schema_version: 1,
    timezone: timezone?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  };
  const content = format === "csv"
    ? `\uFEFF${toCsv(metadata, events)}`
    : JSON.stringify({ metadata, events }, null, 2);
  const blob = new Blob([content], {
    type: format === "csv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `traefik-manager-bottleneck-events-${filters.event}-${filters.period === "all" ? "all-time" : `${filters.period}d`}-${metadata.exported_at.slice(0, 10)}.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return link.download;
}

function toCsv(
  metadata: ManagerDeploymentBottleneckEventExportMetadata,
  events: ManagerDeploymentBottleneckEvent[],
): string {
  const metadataRows = [
    ["schema_version", metadata.schema_version],
    ["exported_at", metadata.exported_at],
    ["timezone", metadata.timezone],
    ["result_count", metadata.result_count],
    ["filter_event", metadata.filters.event],
    ["filter_period", metadata.filters.period],
  ] as const;
  return [
    "metadata,value",
    ...metadataRows.map(([key, value]) => `${key},${csvCell(value)}`),
    "",
    CSV_COLUMNS.join(","),
    ...events.map((event) => CSV_COLUMNS.map((column) => csvCell(event[column])).join(",")),
  ].join("\r\n");
}

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  const safe = /^[=+\-@\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
