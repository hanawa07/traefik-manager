export const SMOKE_FAILURE_RATE_WINDOW_DAYS = 7;
export const SMOKE_FAILURE_RATE_THRESHOLD_PERCENT = 30;
export const SMOKE_FAILURE_RATE_MIN_RUNS = 3;

interface SmokeRunResult {
  status: "success" | "failure" | "skipped";
  completed_at: string;
}

export function getSmokeRunFailureRate(runs: SmokeRunResult[], referenceTime: number) {
  const cutoff =
    referenceTime - SMOKE_FAILURE_RATE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const completed = runs.filter((run) => {
    const completedAt = Date.parse(run.completed_at);
    return run.status !== "skipped" && Number.isFinite(completedAt) && completedAt >= cutoff;
  });
  const failureCount = completed.filter((run) => run.status === "failure").length;
  const percentage = completed.length
    ? Math.round((failureCount / completed.length) * 100)
    : 0;
  return {
    failureCount,
    isAlert:
      completed.length >= SMOKE_FAILURE_RATE_MIN_RUNS &&
      percentage >= SMOKE_FAILURE_RATE_THRESHOLD_PERCENT,
    percentage,
    totalCount: completed.length,
  };
}
