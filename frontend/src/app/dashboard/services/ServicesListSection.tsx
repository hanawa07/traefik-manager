import Link from "next/link";
import { Plus, Server } from "lucide-react";

import type { Certificate } from "@/features/certificates/api/certificateApi";
import type { Service, UpstreamHealth } from "@/features/services/api/serviceApi";
import ServiceCard from "@/features/services/components/ServiceCard";
import type { TraefikRouterStatus } from "@/features/traefik/api/traefikApi";
import type { HealthHistoryEntry } from "./useServicesPageModel";

interface ServicesListSectionProps {
  isLoading: boolean;
  services: Service[];
  search: string;
  canManage: boolean;
  routerStatus?: TraefikRouterStatus;
  healthMap?: Record<string, UpstreamHealth>;
  healthHistory: Record<string, HealthHistoryEntry>;
  certificateMap: Record<string, Certificate>;
  displayTimeZone?: string;
  onClearSearch: () => void;
  onDelete: (service: Service) => void;
}

export default function ServicesListSection({
  isLoading,
  services,
  search,
  canManage,
  routerStatus,
  healthMap,
  healthHistory,
  certificateMap,
  displayTimeZone,
  onClearSearch,
  onDelete,
}: ServicesListSectionProps) {
  if (isLoading) return <ServicesLoadingGrid />;
  if (services.length === 0) {
    return (
      <ServicesEmptyState
        search={search}
        canManage={canManage}
        onClearSearch={onClearSearch}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {services.map((service) => (
        <ServiceCard
          key={service.id}
          service={service}
          onDelete={onDelete}
          routerActive={routerStatus?.domains?.[service.domain]?.active}
          canManage={canManage}
          upstreamHealth={healthMap?.[service.id]}
          displayTimeZone={displayTimeZone}
          lastSuccessAt={healthHistory[service.id]?.last_up_at}
          lastFailureAt={healthHistory[service.id]?.last_down_at}
          certificate={certificateMap[service.domain]}
        />
      ))}
    </div>
  );
}

function ServicesLoadingGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {[...Array(6)].map((_, index) => (
        <div key={index} className="card h-36 animate-pulse p-5" />
      ))}
    </div>
  );
}

function ServicesEmptyState({
  search,
  canManage,
  onClearSearch,
}: {
  search: string;
  canManage: boolean;
  onClearSearch: () => void;
}) {
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
