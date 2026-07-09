import { History } from "lucide-react";

export function AuditLogPageHeader() {
  return (
    <div className="mb-8 flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:shadow-none">
        <History className="h-5 w-5 text-blue-400" />
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-100">감사 로그</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">시스템의 모든 변경 사항을 추적합니다.</p>
      </div>
    </div>
  );
}
