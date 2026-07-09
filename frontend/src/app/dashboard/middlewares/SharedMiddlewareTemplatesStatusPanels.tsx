import { Layers3, Shield } from "lucide-react";

export function RuntimeStatusBanner({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 dark:border-yellow-500/50 dark:bg-yellow-950/30">
      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Traefik 런타임 상태 확인</p>
      <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">{message}</p>
    </div>
  );
}

export function SharedMiddlewareLoadingState() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, index) => (
        <div key={index} className="h-40 animate-pulse rounded-2xl bg-gray-100 dark:bg-slate-800" />
      ))}
    </div>
  );
}

export function SharedMiddlewareErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center dark:border-red-500/50 dark:bg-red-950/30">
      <Shield className="mx-auto mb-3 h-10 w-10 text-red-300 dark:text-red-400" />
      <p className="text-sm font-medium text-red-600 dark:text-red-300">미들웨어 관리 화면을 불러오지 못했습니다</p>
      <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">{message}</p>
    </div>
  );
}

export function SharedMiddlewareEmptyState({
  canManage,
  onCreateOpen,
}: {
  canManage: boolean;
  onCreateOpen: () => void;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center text-gray-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
      <Layers3 className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-slate-600" />
      <p className="text-sm">등록된 공유 미들웨어 템플릿이 없습니다</p>
      <p className="mt-2 text-xs text-gray-400 dark:text-slate-500">
        서비스별 자동 생성 미들웨어는 옆 탭에서 확인하고, 재사용할 공용 규칙만 여기서 관리합니다.
      </p>
      {canManage ? (
        <button className="mt-3 text-sm text-blue-500 hover:underline dark:text-blue-300" onClick={onCreateOpen}>
          첫 번째 템플릿 추가하기
        </button>
      ) : null}
    </div>
  );
}

export function SharedMiddlewareFilteredEmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white py-12 text-center text-gray-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
      <Layers3 className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-slate-600" />
      <p className="text-sm">검색 조건에 맞는 공유 미들웨어 템플릿이 없습니다</p>
      <p className="mt-2 text-xs text-gray-400 dark:text-slate-500">검색어를 줄이거나 상태 필터를 전체로 바꿔 다시 확인하세요.</p>
      <button className="mt-3 text-sm text-blue-500 hover:underline dark:text-blue-300" onClick={onReset}>
        조건 초기화
      </button>
    </div>
  );
}
