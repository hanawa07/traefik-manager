import { Download } from "lucide-react";

import { AuditRotationExportControls } from "./AuditRotationExportControls";

interface AuditLogExportControlsProps {
  exportUrl: string;
}

const EXPORT_LINK_CLASS =
  "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:shadow-none dark:hover:border-blue-500 dark:hover:text-blue-200";

export function AuditLogExportControls({ exportUrl }: AuditLogExportControlsProps) {
  return (
    <div className="ml-auto flex flex-wrap gap-2">
      <AuditRotationExportControls linkClassName={EXPORT_LINK_CLASS} />
      <a
        aria-label="현재 감사 조건 CSV 다운로드"
        className={EXPORT_LINK_CLASS}
        href={exportUrl}
      >
        <Download className="h-4 w-4" />
        현재 조건 CSV
      </a>
    </div>
  );
}
