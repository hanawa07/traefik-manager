import Link from "next/link";
import { Plus, Server } from "lucide-react";

interface ServicesEmptyStateProps {
  search: string;
  canManage: boolean;
  onClearSearch: () => void;
}

export function ServicesEmptyState({
  search,
  canManage,
  onClearSearch,
}: ServicesEmptyStateProps) {
  return (
    <div className="card py-20 text-center">
      <Server className="mx-auto mb-4 h-12 w-12 text-gray-300" />
      <p className="font-medium text-gray-500">
        {search ? `"${search}" 검색 결과가 없습니다` : "등록된 서비스가 없습니다"}
      </p>
      {search ? (
        <button
          type="button"
          onClick={onClearSearch}
          className="mt-2 text-sm text-blue-500 hover:underline"
        >
          검색 초기화
        </button>
      ) : canManage ? (
        <Link href="/dashboard/services/new" className="btn-primary mt-4 inline-flex items-center gap-2">
          <Plus className="h-4 w-4" />
          서비스 추가
        </Link>
      ) : null}
    </div>
  );
}
