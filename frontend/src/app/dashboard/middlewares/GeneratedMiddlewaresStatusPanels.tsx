import { RefreshCw, Sparkles } from "lucide-react";

import { extractErrorMessage } from "./middlewarePageHelpers";

interface GeneratedMiddlewaresStatusPanelsProps {
  emptyDescription: string;
  emptyTitle: string;
  generatedServiceCount: number;
  isRuntimeLoading: boolean;
  isServicesError: boolean;
  isRetrying: boolean;
  isServicesLoading: boolean;
  servicesError: unknown;
  onRetry: () => void;
}

export function GeneratedRuntimeBanner({
  runtimeBannerMessage,
}: {
  runtimeBannerMessage: string | null;
}) {
  if (!runtimeBannerMessage) return null;

  return (
    <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 dark:border-yellow-500/50 dark:bg-yellow-950/30">
      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Traefik 런타임 상태 확인</p>
      <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">{runtimeBannerMessage}</p>
    </div>
  );
}

export function GeneratedMiddlewaresStatusPanels({
  emptyDescription,
  emptyTitle,
  generatedServiceCount,
  isRuntimeLoading,
  isServicesError,
  isRetrying,
  isServicesLoading,
  servicesError,
  onRetry,
}: GeneratedMiddlewaresStatusPanelsProps) {
  if (isServicesLoading || isRuntimeLoading) return <GeneratedMiddlewaresLoadingState />;
  if (isServicesError) {
    return (
      <GeneratedMiddlewaresErrorState
        isRetrying={isRetrying}
        onRetry={onRetry}
        servicesError={servicesError}
      />
    );
  }
  if (generatedServiceCount === 0) {
    return <GeneratedMiddlewaresEmptyState description={emptyDescription} title={emptyTitle} />;
  }
  return null;
}

function GeneratedMiddlewaresLoadingState() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, index) => (
        <div key={index} className="h-44 animate-pulse rounded-2xl bg-gray-100 dark:bg-slate-800" />
      ))}
    </div>
  );
}

function GeneratedMiddlewaresErrorState({
  isRetrying,
  onRetry,
  servicesError,
}: {
  isRetrying: boolean;
  onRetry: () => void;
  servicesError: unknown;
}) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center dark:border-red-500/50 dark:bg-red-950/30">
      <Sparkles className="mx-auto mb-3 h-10 w-10 text-red-300 dark:text-red-400" />
      <p className="text-sm font-medium text-red-600 dark:text-red-300">서비스 자동 생성 미들웨어를 계산할 수 없습니다</p>
      <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
        {extractErrorMessage(servicesError, "서비스 목록을 불러오지 못했습니다")}
      </p>
      <button
        className="btn-secondary mt-4 inline-flex items-center gap-1.5 px-3 py-2 text-xs"
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

function GeneratedMiddlewaresEmptyState({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center text-gray-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
      <Sparkles className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-slate-600" />
      <p className="text-sm">{title}</p>
      <p className="mt-2 text-xs text-gray-400 dark:text-slate-500">{description}</p>
    </div>
  );
}
