import type {
  SmokeLocalRun,
  SmokeStatisticsSnapshot,
} from "@/features/settings/api/settingsApi";

const CSV_COLUMNS = [
  "captured_on",
  "window_days",
  "total_count",
  "success_count",
  "failure_count",
  "cancelled_count",
  "skipped_count",
  "duration_run_count",
  "total_duration_seconds",
  "average_duration_seconds",
  "estimated_runner_minutes",
  "failure_rate_percent",
] as const;

const LOCAL_RUN_CSV_COLUMNS = [
  "run_id",
  "status",
  "started_at",
  "completed_at",
  "duration_seconds",
  "admin_checked",
  "run_url",
] as const;

export function getSmokeStatisticsSnapshotComparison(
  snapshots: SmokeStatisticsSnapshot[],
) {
  if (snapshots.length < 2) return null;
  const [latest, previous] = snapshots;
  return {
    averageDurationSeconds:
      latest.average_duration_seconds - previous.average_duration_seconds,
    estimatedRunnerMinutes:
      latest.estimated_runner_minutes - previous.estimated_runner_minutes,
    failureRatePercentagePoints: getFailureRate(latest) - getFailureRate(previous),
    previousCapturedOn: previous.captured_on,
  };
}

export function buildSmokeStatisticsSnapshotsCsv(
  snapshots: SmokeStatisticsSnapshot[],
): string {
  const rows = snapshots.map((snapshot) => [
    snapshot.captured_on,
    snapshot.window_days,
    snapshot.total_count,
    snapshot.success_count,
    snapshot.failure_count,
    snapshot.cancelled_count,
    snapshot.skipped_count,
    snapshot.duration_run_count,
    snapshot.total_duration_seconds,
    snapshot.average_duration_seconds,
    snapshot.estimated_runner_minutes,
    getFailureRate(snapshot),
  ]);
  return `\uFEFF${[CSV_COLUMNS, ...rows].map((row) => row.map(toCsvCell).join(",")).join("\r\n")}\r\n`;
}

export function downloadSmokeStatisticsSnapshots(
  snapshots: SmokeStatisticsSnapshot[],
): void {
  downloadCsv(
    buildSmokeStatisticsSnapshotsCsv(snapshots),
    `traefik-manager-smoke-statistics-${today()}.csv`,
  );
}

export function getSmokeRunUrl(workflowUrl: string, runId: number): string {
  const [repositoryUrl] = workflowUrl.split("/actions/workflows/");
  return `${repositoryUrl.replace(/\/+$/, "")}/actions/runs/${runId}`;
}

export function buildSmokeLocalRunsCsv(
  localRuns: SmokeLocalRun[],
  workflowUrl: string,
): string {
  const rows = localRuns.map((run) => [
    run.run_id,
    run.status,
    run.started_at,
    run.completed_at,
    run.duration_seconds,
    run.admin_checked,
    getSmokeRunUrl(workflowUrl, run.run_id),
  ]);
  return `\uFEFF${[LOCAL_RUN_CSV_COLUMNS, ...rows].map((row) => row.map(toCsvCell).join(",")).join("\r\n")}\r\n`;
}

export function downloadSmokeLocalRuns(
  localRuns: SmokeLocalRun[],
  workflowUrl: string,
): void {
  downloadCsv(
    buildSmokeLocalRunsCsv(localRuns, workflowUrl),
    `traefik-manager-smoke-local-runs-${today()}.csv`,
  );
}

function getFailureRate(snapshot: SmokeStatisticsSnapshot): number {
  const completedRuns = snapshot.success_count + snapshot.failure_count;
  return completedRuns
    ? Math.round((snapshot.failure_count / completedRuns) * 100)
    : 0;
}

function downloadCsv(content: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function toCsvCell(value: string | number | boolean | null): string {
  let text = value === null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
