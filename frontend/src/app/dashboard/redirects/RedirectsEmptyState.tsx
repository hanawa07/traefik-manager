import { ArrowRightLeft } from "lucide-react";

interface RedirectsEmptyStateProps {
  canManage: boolean;
  onCreate: () => void;
}

export function RedirectsEmptyState({ canManage, onCreate }: RedirectsEmptyStateProps) {
  return (
    <div className="py-16 text-center text-gray-500">
      <ArrowRightLeft className="mx-auto mb-3 h-10 w-10 text-gray-300" />
      <p className="text-sm">등록된 리다이렉트가 없습니다</p>
      {canManage ? (
        <button
          type="button"
          className="mt-2 text-sm text-blue-500 hover:underline"
          onClick={onCreate}
        >
          첫 번째 리다이렉트 추가하기
        </button>
      ) : null}
    </div>
  );
}
