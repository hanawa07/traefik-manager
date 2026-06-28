import Link from "next/link";
import { Search, Sparkles } from "lucide-react";

import StatusBadge from "@/shared/components/StatusBadge";
import type { Service } from "@/features/services/api/serviceApi";
import {
  type GeneratedMiddlewareItem,
  extractErrorMessage,
} from "./middlewarePageHelpers";

interface GeneratedMiddlewaresTabProps {
  generatedSearch: string;
  onGeneratedSearchChange: (value: string) => void;
  runtimeBannerMessage: string | null;
  isServicesLoading: boolean;
  isRuntimeLoading: boolean;
  isServicesError: boolean;
  servicesError: unknown;
  generatedServiceCount: number;
  generatedServiceGroups: Array<{
    service: Service;
    items: GeneratedMiddlewareItem[];
  }>;
}

export default function GeneratedMiddlewaresTab({
  generatedSearch,
  onGeneratedSearchChange,
  runtimeBannerMessage,
  isServicesLoading,
  isRuntimeLoading,
  isServicesError,
  servicesError,
  generatedServiceCount,
  generatedServiceGroups,
}: GeneratedMiddlewaresTabProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">서비스별 자동 생성 미들웨어</p>
            <p className="mt-1 text-xs text-gray-500">
              서비스 설정에서 자동 만들어지는 실제 Traefik 미들웨어만 모아봅니다. 공유 템플릿은 여기서 제외됩니다.
            </p>
          </div>
          <div className="relative w-full lg:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={generatedSearch}
              onChange={(event) => onGeneratedSearchChange(event.target.value)}
              className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-blue-400"
              placeholder="서비스 이름 또는 도메인 검색"
            />
          </div>
        </div>
      </div>

      {runtimeBannerMessage ? (
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3">
          <p className="text-sm font-medium text-yellow-800">Traefik 런타임 상태 확인</p>
          <p className="mt-1 text-xs text-yellow-700">{runtimeBannerMessage}</p>
        </div>
      ) : null}

      {isServicesLoading || isRuntimeLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="h-44 animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
      ) : isServicesError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center">
          <Sparkles className="mx-auto mb-3 h-10 w-10 text-red-300" />
          <p className="text-sm font-medium text-red-600">서비스 자동 생성 미들웨어를 계산할 수 없습니다</p>
          <p className="mt-2 text-xs text-gray-500">
            {extractErrorMessage(servicesError, "서비스 목록을 불러오지 못했습니다")}
          </p>
        </div>
      ) : generatedServiceCount === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center text-gray-500">
          <Sparkles className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm">조건에 맞는 자동 생성 미들웨어가 없습니다</p>
          <p className="mt-2 text-xs text-gray-400">
            허용 IP, 서비스 Rate Limit, 프레임 정책, Basic Auth, HTTPS 리다이렉트 같은 서비스 옵션을 켜면 여기에 표시됩니다.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {generatedServiceGroups.map(({ service, items }) => (
            <article key={service.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/dashboard/services/${service.id}`}
                      className="text-lg font-semibold text-gray-900 hover:text-blue-700"
                    >
                      {service.name}
                    </Link>
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
                      {items.length}개 자동 생성
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">{service.domain}</p>
                </div>
                <Link
                  href={`/dashboard/services/${service.id}`}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                  서비스 설정 열기
                </Link>
              </div>

              <div className="mt-4 space-y-3">
                {items.map((item) => (
                  <div
                    key={`${service.id}-${item.runtimeName}`}
                    className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50/80 p-4 lg:flex-row lg:items-start lg:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                        {item.scope === "shared" ? (
                          <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700">
                            공용
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 font-mono text-xs text-gray-500">{item.runtimeName}</p>
                      <p className="mt-2 text-sm text-gray-600">{item.description}</p>
                    </div>
                    <div className="flex flex-col items-start gap-2 lg:items-end">
                      <StatusBadge status={item.status} />
                      <span className="text-xs text-gray-400">{item.runtimeStatusLabel}</span>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
