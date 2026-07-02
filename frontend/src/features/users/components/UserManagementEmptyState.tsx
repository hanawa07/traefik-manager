import { Users } from "lucide-react";

interface UserManagementEmptyStateProps {
  onCreate: () => void;
}

export function UserManagementEmptyState({ onCreate }: UserManagementEmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 py-12 text-center">
      <Users className="mx-auto mb-3 h-10 w-10 text-gray-300" />
      <p className="text-sm font-medium text-gray-600">등록된 사용자가 없습니다</p>
      <button
        type="button"
        className="mt-3 text-sm text-blue-500 hover:underline"
        onClick={onCreate}
      >
        첫 번째 사용자 추가하기
      </button>
    </div>
  );
}
