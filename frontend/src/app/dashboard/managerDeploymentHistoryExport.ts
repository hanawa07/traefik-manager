import type { ManagerDeploymentHistoryEntry } from "@/features/deployment/api/deploymentApi";

import type {
  ManagerDeploymentHistoryRecordSource,
  ManagerDeploymentHistorySourceFilter,
} from "./managerDeploymentHistoryQuery";

export type ManagerDeploymentHistoryExportFormat = "csv" | "json";
type ManagerDeploymentHistoryExportEntry = ManagerDeploymentHistoryEntry & {
  source?: ManagerDeploymentHistoryRecordSource;
};
type ManagerDeploymentHistoryExportColumn = keyof ManagerDeploymentHistoryExportEntry;

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
  source: ManagerDeploymentHistorySourceFilter,
  format: ManagerDeploymentHistoryExportFormat,
  resolveSource?: (entry: ManagerDeploymentHistoryEntry) => ManagerDeploymentHistoryRecordSource,
): string {
  if (source === "all" && !resolveSource) {
    throw new Error("통합 배포 이력 source 확인 함수가 필요합니다.");
  }
  const includeSource = source === "all";
  const exportEntries: ManagerDeploymentHistoryExportEntry[] = includeSource
    ? entries.map((entry) => ({ source: resolveSource!(entry), ...entry }))
    : entries;
  const content = format === "csv"
    ? `\uFEFF${toCsv(exportEntries, includeSource)}`
    : JSON.stringify(exportEntries, null, 2);
  const blob = new Blob([content], {
    type: format === "csv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `traefik-manager-deployments-${source}-${new Date().toISOString().slice(0, 10)}.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return link.download;
}

function toCsv(entries: ManagerDeploymentHistoryExportEntry[], includeSource: boolean): string {
  const columns: readonly ManagerDeploymentHistoryExportColumn[] = includeSource
    ? ["source", ...CSV_COLUMNS]
    : CSV_COLUMNS;
  return [
    columns.join(","),
    ...entries.map((entry) => columns.map((column) => csvCell(entry[column])).join(",")),
  ].join("\r\n");
}

function csvCell(value: ManagerDeploymentHistoryExportEntry[ManagerDeploymentHistoryExportColumn]): string {
  const text = value == null ? "" : String(value);
  const safe = /^[=+\-@\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
