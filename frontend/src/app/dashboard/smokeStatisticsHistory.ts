import type { SmokeStatisticsSnapshot } from "@/features/settings/api/settingsApi";

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
  const blob = new Blob([buildSmokeStatisticsSnapshotsCsv(snapshots)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `traefik-manager-smoke-statistics-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function getFailureRate(snapshot: SmokeStatisticsSnapshot): number {
  const completedRuns = snapshot.success_count + snapshot.failure_count;
  return completedRuns
    ? Math.round((snapshot.failure_count / completedRuns) * 100)
    : 0;
}

function toCsvCell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
