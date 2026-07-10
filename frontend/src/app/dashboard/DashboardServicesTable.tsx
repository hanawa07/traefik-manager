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
      <div className="flex flex-col items-stretch gap-3 border-b border-gray-100 px-6 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-semibold text-gray-900 dark:text-slate-100">서비스 목록</h2>
        {canManage ? (
          <Link href="/dashboard/services/new" className="btn-primary text-center py-1.5 text-sm">
            + 서비스 추가
          </Link>
        ) : null}
      </div>

      {isLoading ? (
        <DashboardServicesTableSkeleton />
      ) : services.length === 0 ? (
        <EmptyDashboardServicesState canManage={canManage} />
      ) : (
        <div className="overflow-x-auto" data-table-scroll="dashboard-services">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400 dark:border-slate-800 dark:text-slate-500">
                <th className="px-6 py-3 text-left font-medium">서비스</th>
                <th className="px-6 py-3 text-left font-medium">도메인</th>
                <th className="px-6 py-3 text-left font-medium">업스트림</th>
                <th className="px-6 py-3 text-left font-medium">TLS</th>
                <th className="px-6 py-3 text-left font-medium">인증</th>
                <th className="px-6 py-3 text-left font-medium">라우터 상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
              {services.map((service) => (
                <DashboardServiceRow key={service.id} service={service} routerStatus={routerStatus} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
