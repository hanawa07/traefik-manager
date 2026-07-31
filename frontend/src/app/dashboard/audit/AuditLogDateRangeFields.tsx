import {
  auditPeriodOptions,
  parseAuditPeriodDays,
  type AuditPeriodDays,
} from "./auditPageHelpers";

interface AuditLogDateRangeFieldsProps {
  endDate: string;
  onDateRangeChange: (startDate: string, endDate: string) => void;
  onPeriodChange: (period: AuditPeriodDays) => void;
  selectedPeriod: AuditPeriodDays;
  startDate: string;
}

const FIELD_CLASS =
  "grid min-w-0 gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:shadow-none";
const CONTROL_CLASS =
  "w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

export function AuditLogDateRangeFields({
  endDate,
  onDateRangeChange,
  onPeriodChange,
  selectedPeriod,
  startDate,
}: AuditLogDateRangeFieldsProps) {
  return (
    <>
      <label className={FIELD_CLASS}>
        <span className="text-slate-500 dark:text-slate-400">감사 기간</span>
        <select
          aria-label="감사 기간"
          value={selectedPeriod}
          onChange={(event) => onPeriodChange(parseAuditPeriodDays(event.target.value))}
          className={CONTROL_CLASS}
        >
          {auditPeriodOptions.map((option) => (
            <option key={option.days} value={option.days}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className={FIELD_CLASS}>
        <span className="text-slate-500 dark:text-slate-400">시작일 (UTC)</span>
        <input
          aria-label="감사 시작일"
          className={`${CONTROL_CLASS} dark:[color-scheme:dark]`}
          max={endDate || undefined}
          onChange={(event) => onDateRangeChange(event.target.value, endDate)}
          type="date"
          value={startDate}
        />
      </label>
      <label className={FIELD_CLASS}>
        <span className="text-slate-500 dark:text-slate-400">종료일 (UTC)</span>
        <input
          aria-label="감사 종료일"
          className={`${CONTROL_CLASS} dark:[color-scheme:dark]`}
          min={startDate || undefined}
          onChange={(event) => onDateRangeChange(startDate, event.target.value)}
          type="date"
          value={endDate}
        />
      </label>
    </>
  );
}
