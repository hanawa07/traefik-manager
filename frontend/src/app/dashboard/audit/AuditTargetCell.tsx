interface AuditTargetCellProps {
  canExpand: boolean;
  contextLabel?: string;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  resourceName: string;
}

export function AuditTargetCell({
  canExpand,
  contextLabel,
  isExpanded,
  onToggleExpanded,
  resourceName,
}: AuditTargetCellProps) {
  return (
    <div className="space-y-2">
      <span className="block text-sm font-bold text-slate-900 transition-colors group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-300">
        {resourceName}
      </span>
      {contextLabel ? (
        <span className="inline-flex rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-200">
          {contextLabel}
        </span>
      ) : null}
      {canExpand ? (
        <button
          type="button"
          onClick={onToggleExpanded}
          className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
        >
          {isExpanded ? "상세 숨기기" : "상세 보기"}
        </button>
      ) : null}
    </div>
  );
}
