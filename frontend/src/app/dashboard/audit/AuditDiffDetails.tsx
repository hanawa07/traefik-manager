import {
  formatAuditValue,
  type getAuditDiffRows,
} from "./auditPageHelpers";

type AuditDiffRows = ReturnType<typeof getAuditDiffRows>;

interface AuditDiffDetailsProps {
  logId: string;
  diffRows: AuditDiffRows;
}

export function AuditDiffDetails({ logId, diffRows }: AuditDiffDetailsProps) {
  if (diffRows.length === 0) {
    return null;
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {diffRows.map((row) => (
          <span
            key={`${logId}-${row.key}`}
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            {row.key}
          </span>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <AuditDiffColumn logId={logId} diffRows={diffRows} valueKey="before" title="이전 값" />
        <AuditDiffColumn logId={logId} diffRows={diffRows} valueKey="after" title="이후 값" />
      </div>
    </>
  );
}

function AuditDiffColumn({
  logId,
  diffRows,
  valueKey,
  title,
}: {
  logId: string;
  diffRows: AuditDiffRows;
  valueKey: "before" | "after";
  title: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</p>
      <div className="space-y-2">
        {diffRows.map((row) => (
          <div key={`${logId}-${row.key}-${valueKey}`} className="grid grid-cols-[160px_1fr] gap-3 text-sm">
            <span className="text-slate-500 dark:text-slate-400">{row.key}</span>
            <span className="break-all text-slate-900 dark:text-slate-100">{formatAuditValue(row[valueKey])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
