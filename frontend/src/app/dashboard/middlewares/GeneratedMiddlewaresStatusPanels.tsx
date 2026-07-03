import { Sparkles } from "lucide-react";

import { extractErrorMessage } from "./middlewarePageHelpers";

interface GeneratedMiddlewaresStatusPanelsProps {
  generatedServiceCount: number;
  isRuntimeLoading: boolean;
  isServicesError: boolean;
  isServicesLoading: boolean;
  servicesError: unknown;
}

export function GeneratedRuntimeBanner({
  runtimeBannerMessage,
}: {
  runtimeBannerMessage: string | null;
}) {
  if (!runtimeBannerMessage) return null;

  return (
    <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3">
      <p className="text-sm font-medium text-yellow-800">Traefik 런타임 상태 확인</p>
      <p className="mt-1 text-xs text-yellow-700">{runtimeBannerMessage}</p>
    </div>
  );
}

export function GeneratedMiddlewaresStatusPanels({
  generatedServiceCount,
  isRuntimeLoading,
  isServicesError,
  isServicesLoading,
  servicesError,
}: GeneratedMiddlewaresStatusPanelsProps) {
  if (isServicesLoading || isRuntimeLoading) return <GeneratedMiddlewaresLoadingState />;
  if (isServicesError) return <GeneratedMiddlewaresErrorState servicesError={servicesError} />;
  if (generatedServiceCount === 0) return <GeneratedMiddlewaresEmptyState />;
  return null;
}

function GeneratedMiddlewaresLoadingState() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, index) => (
        <div key={index} className="h-44 animate-pulse rounded-2xl bg-gray-100" />
      ))}
    </div>
  );
}

function GeneratedMiddlewaresErrorState({ servicesError }: { servicesError: unknown }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center">
      <Sparkles className="mx-auto mb-3 h-10 w-10 text-red-300" />
      <p className="text-sm font-medium text-red-600">서비스 자동 생성 미들웨어를 계산할 수 없습니다</p>
      <p className="mt-2 text-xs text-gray-500">
        {extractErrorMessage(servicesError, "서비스 목록을 불러오지 못했습니다")}
      </p>
    </div>
  );
}

function GeneratedMiddlewaresEmptyState() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center text-gray-500">
      <Sparkles className="mx-auto mb-3 h-10 w-10 text-gray-300" />
      <p className="text-sm">조건에 맞는 자동 생성 미들웨어가 없습니다</p>
      <p className="mt-2 text-xs text-gray-400">
        허용 IP, 서비스 Rate Limit, 프레임 정책, Basic Auth, HTTPS 리다이렉트 같은 서비스 옵션을 켜면 여기에 표시됩니다.
      </p>
    </div>
  );
}
