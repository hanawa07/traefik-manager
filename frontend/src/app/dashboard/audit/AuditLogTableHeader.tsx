const TABLE_HEADERS = ["사용자", "이벤트", "작업", "대상 타입", "대상 이름", "발생 시각"];

export function AuditLogTableHeader() {
  return (
    <thead>
      <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
        {TABLE_HEADERS.map((header) => (
          <th
            key={header}
            className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
          >
            {header}
          </th>
        ))}
      </tr>
    </thead>
  );
}
