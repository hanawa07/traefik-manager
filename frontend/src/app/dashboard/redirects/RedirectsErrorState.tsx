import { RefreshCw, RouteOff } from "lucide-react";

interface RedirectsErrorStateProps {
  isRetrying: boolean;
  message: string;
  onRetry: () => void;
}

export function RedirectsErrorState({
  isRetrying,
  message,
  onRetry,
}: RedirectsErrorStateProps) {
  return (
    <div
      className="px-6 py-14 text-center"
      data-testid="redirects-list-error"
      role="alert"
    >
      <RouteOff className="mx-auto mb-3 h-10 w-10 text-red-300 dark:text-red-400" />
      <p className="text-sm font-medium text-red-700 dark:text-red-300">
        리다이렉트 목록을 불러오지 못했습니다
      </p>
      <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">{message}</p>
      <button
        className="btn-secondary mt-4 inline-flex items-center gap-1.5 px-3 py-2 text-xs"
        data-testid="redirects-list-retry"
        disabled={isRetrying}
        onClick={onRetry}
        type="button"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isRetrying ? "animate-spin" : ""}`} />
        {isRetrying ? "다시 확인 중" : "다시 시도"}
      </button>
    </div>
  );
}
