import type { ManagerDeploymentHistoryEntry } from "@/features/deployment/api/deploymentApi";

export type ManagerDeploymentHistorySource = "all" | "archive" | "current";
export type ManagerDeploymentHistoryExportFormat = "csv" | "json";

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
  source: ManagerDeploymentHistorySource,
  format: ManagerDeploymentHistoryExportFormat,
): string {
  const content = format === "csv"
    ? `\uFEFF${toCsv(entries)}`
    : JSON.stringify(entries, null, 2);
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

function toCsv(entries: ManagerDeploymentHistoryEntry[]): string {
  return [
    CSV_COLUMNS.join(","),
    ...entries.map((entry) => CSV_COLUMNS.map((column) => csvCell(entry[column])).join(",")),
  ].join("\r\n");
}

function csvCell(value: ManagerDeploymentHistoryEntry[keyof ManagerDeploymentHistoryEntry]): string {
  const text = value == null ? "" : String(value);
  const safe = /^[=+\-@\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
