import { RefreshCw, ServerCrash } from "lucide-react";

interface ServicesErrorStateProps {
  error: unknown;
  isRetrying: boolean;
  onRetry: () => void;
}

export function ServicesErrorState({
  error,
  isRetrying,
  onRetry,
}: ServicesErrorStateProps) {
  return (
    <div
      className="card border-red-200 bg-red-50 py-16 text-center dark:border-red-500/50 dark:bg-red-950/30"
      data-testid="services-list-error"
      role="alert"
    >
      <ServerCrash className="mx-auto mb-3 h-10 w-10 text-red-300 dark:text-red-400" />
      <p className="text-sm font-medium text-red-700 dark:text-red-300">
        서비스 목록을 불러오지 못했습니다
      </p>
      <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
        {getErrorMessage(error)}
      </p>
      <button
        className="btn-secondary mt-4 inline-flex items-center gap-1.5 px-3 py-2 text-xs"
        data-testid="services-list-retry"
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

function getErrorMessage(error: unknown): string {
  return (
    (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
    (error as { message?: string })?.message ||
    "잠시 후 다시 시도해 주세요."
  );
}
