interface ManagerDeploymentDateRangeProps {
  dateFrom: string;
  dateTo: string;
  onChange: (dates: { dateFrom: string; dateTo: string }) => void;
}

export function ManagerDeploymentDateRange({
  dateFrom,
  dateTo,
  onChange,
}: ManagerDeploymentDateRangeProps) {
  const updateDateFrom = (nextDateFrom: string) => {
    onChange({
      dateFrom: nextDateFrom,
      dateTo: nextDateFrom && dateTo && nextDateFrom > dateTo ? nextDateFrom : dateTo,
    });
  };
  const updateDateTo = (nextDateTo: string) => {
    onChange({
      dateFrom: nextDateTo && dateFrom && nextDateTo < dateFrom ? nextDateTo : dateFrom,
      dateTo: nextDateTo,
    });
  };

  return (
    <fieldset className="mt-2 grid gap-2 sm:grid-cols-2 lg:max-w-xl">
      <legend className="sr-only">배포 이력 사용자 지정 기간</legend>
      <label className="grid gap-1 text-[11px] font-medium text-gray-500 dark:text-slate-400">
        시작일
        <input
          className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs text-gray-700 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          data-history-date-from
          max={dateTo || undefined}
          onChange={(event) => updateDateFrom(event.target.value)}
          type="date"
          value={dateFrom}
        />
      </label>
      <label className="grid gap-1 text-[11px] font-medium text-gray-500 dark:text-slate-400">
        종료일
        <input
          className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs text-gray-700 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          data-history-date-to
          min={dateFrom || undefined}
          onChange={(event) => updateDateTo(event.target.value)}
          type="date"
          value={dateTo}
        />
      </label>
    </fieldset>
  );
}
