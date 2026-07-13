import { formatAuditValue } from "./auditPageHelpers";


interface AuditDetailRow {
  key: string;
  label: string;
  value: unknown;
}

interface AuditDetailListProps {
  logId: string;
  rows: AuditDetailRow[];
  testId?: string;
  title: string;
}

export function AuditDetailList({ logId, rows, testId, title }: AuditDetailListProps) {
  if (rows.length === 0) return null;

  return (
    <div
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      data-testid={testId}
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {title}
      </p>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={`${logId}-${row.key}-detail`} className="grid gap-1 text-sm sm:grid-cols-[160px_1fr] sm:gap-3">
            <span className="text-slate-500 dark:text-slate-400">{row.label}</span>
            <span className="break-all text-slate-900 dark:text-slate-100">
              {formatAuditValue(row.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
