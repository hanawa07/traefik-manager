interface AuditDiffRow {
  key: string;
  before: unknown;
  after: unknown;
}

export function getAuditRetryDelayChange(rows: readonly AuditDiffRow[]) {
  const row = rows.find((item) => item.key === "automatic_retry_delay_warning_minutes");
  if (
    typeof row?.before !== "number" ||
    typeof row.after !== "number" ||
    !Number.isFinite(row.before) ||
    !Number.isFinite(row.after) ||
    row.before === row.after
  ) {
    return null;
  }
  const deltaMinutes = row.after - row.before;
  return {
    afterMinutes: row.after,
    beforeMinutes: row.before,
    deltaMinutes,
    direction: deltaMinutes > 0 ? "up" : "down",
  } as const;
}
