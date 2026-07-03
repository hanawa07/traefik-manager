import Link from "next/link";

import type { Service } from "@/features/services/api/serviceApi";
import type { TraefikRouterStatus } from "@/features/traefik/api/traefikApi";

import { DashboardServiceRow } from "./DashboardServiceRow";
import {
  DashboardServicesTableSkeleton,
  EmptyDashboardServicesState,
} from "./DashboardServicesTableStates";

interface DashboardServicesTableProps {
  canManage: boolean;
  isLoading: boolean;
  services: Service[];
  routerStatus?: TraefikRouterStatus;
}

export function DashboardServicesTable({
  canManage,
  isLoading,
  services,
  routerStatus,
}: DashboardServicesTableProps) {
  return (
    <div className="card">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <h2 className="font-semibold text-gray-900">서비스 목록</h2>
        {canManage ? (
          <Link href="/dashboard/services/new" className="btn-primary py-1.5 text-sm">
            + 서비스 추가
          </Link>
        ) : null}
      </div>

      {isLoading ? (
        <DashboardServicesTableSkeleton />
      ) : services.length === 0 ? (
        <EmptyDashboardServicesState canManage={canManage} />
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 text-xs text-gray-400">
              <th className="px-6 py-3 text-left font-medium">서비스</th>
              <th className="px-6 py-3 text-left font-medium">도메인</th>
              <th className="px-6 py-3 text-left font-medium">업스트림</th>
              <th className="px-6 py-3 text-left font-medium">TLS</th>
              <th className="px-6 py-3 text-left font-medium">인증</th>
              <th className="px-6 py-3 text-left font-medium">라우터 상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {services.map((service) => (
              <DashboardServiceRow key={service.id} service={service} routerStatus={routerStatus} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
