import { Download, History } from "lucide-react";

interface AuditLogPageHeaderProps {
  exportUrl: string;
  smokeRotationExportUrl: string;
}

const EXPORT_LINK_CLASS =
  "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:shadow-none dark:hover:border-blue-500 dark:hover:text-blue-200";

export function AuditLogPageHeader({
  exportUrl,
  smokeRotationExportUrl,
}: AuditLogPageHeaderProps) {
  return (
    <div className="mb-8 flex flex-wrap items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:shadow-none">
        <History className="h-5 w-5 text-blue-400" />
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-100">감사 로그</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">시스템의 모든 변경 사항을 추적합니다.</p>
      </div>
      <div className="ml-auto flex flex-wrap gap-2">
        <a
          aria-label="Secret 회전 CSV 다운로드"
          className={EXPORT_LINK_CLASS}
          href={smokeRotationExportUrl}
        >
          <Download className="h-4 w-4" />
          Secret 회전 CSV
        </a>
        <a
          aria-label="현재 감사 조건 CSV 다운로드"
          className={EXPORT_LINK_CLASS}
          href={exportUrl}
        >
          <Download className="h-4 w-4" />
          현재 조건 CSV
        </a>
      </div>
    </div>
  );
}
