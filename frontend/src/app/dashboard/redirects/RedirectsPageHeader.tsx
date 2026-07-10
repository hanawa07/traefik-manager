import { Plus } from "lucide-react";

interface RedirectsPageHeaderProps {
  canManage: boolean;
  redirectCount: number;
  onCreate: () => void;
}

export function RedirectsPageHeader({
  canManage,
  redirectCount,
  onCreate,
}: RedirectsPageHeaderProps) {
  return (
    <div className="mb-8 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">리다이렉트</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          도메인 리다이렉트 호스트 관리 ({redirectCount}개)
        </p>
      </div>
      {canManage ? (
        <button className="btn-primary inline-flex items-center gap-2" onClick={onCreate}>
          <Plus className="h-4 w-4" />
          리다이렉트 추가
        </button>
      ) : null}
    </div>
  );
}
