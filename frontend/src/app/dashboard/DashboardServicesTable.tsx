import { Server } from "lucide-react";
import Link from "next/link";

import type { Service } from "@/features/services/api/serviceApi";
import type { TraefikRouterStatus } from "@/features/traefik/api/traefikApi";

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
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">서비스 목록</h2>
        {canManage ? (
          <Link href="/dashboard/services/new" className="btn-primary text-sm py-1.5">
            + 서비스 추가
          </Link>
        ) : null}
      </div>

      {isLoading ? (
        <ServicesTableSkeleton />
      ) : services.length === 0 ? (
        <EmptyServicesState canManage={canManage} />
      ) : (
        <table className="w-full">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-100">
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
              <ServiceRow key={service.id} service={service} routerStatus={routerStatus} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ServicesTableSkeleton() {
  return (
    <div className="p-6 space-y-3">
      {[...Array(3)].map((_, index) => (
        <div key={index} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

function EmptyServicesState({ canManage }: { canManage: boolean }) {
  return (
    <div className="py-16 text-center text-gray-400">
      <Server className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p className="text-sm">등록된 서비스가 없습니다</p>
      {canManage ? (
        <Link href="/dashboard/services/new" className="text-blue-500 text-sm hover:underline mt-2 inline-block">
          첫 번째 서비스 추가하기
        </Link>
      ) : null}
    </div>
  );
}

function ServiceRow({
  service,
  routerStatus,
}: {
  service: Service;
  routerStatus?: TraefikRouterStatus;
}) {
  const routerActive = routerStatus?.domains?.[service.domain]?.active;

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-6 py-3 font-medium text-sm text-gray-900">{service.name}</td>
      <td className="px-6 py-3 text-sm text-gray-500">{service.domain}</td>
      <td className="px-6 py-3 text-sm text-gray-400">
        {service.upstream_host}:{service.upstream_port}
      </td>
      <td className="px-6 py-3">
        <StatusPill
          label={service.tls_enabled ? "HTTPS" : "HTTP"}
          className={service.tls_enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}
        />
      </td>
      <td className="px-6 py-3">
        <StatusPill label={getAuthLabel(service)} className={getAuthClassName(service)} />
      </td>
      <td className="px-6 py-3">
        <StatusPill label={getRouterStatusLabel(routerActive)} className={getRouterStatusClassName(routerActive)} />
      </td>
    </tr>
  );
}

function StatusPill({ label, className }: { label: string; className: string }) {
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${className}`}>{label}</span>;
}

function getAuthLabel(service: Service) {
  if (service.auth_mode === "authentik") return "Authentik";
  if (service.auth_mode === "token") return "Token";
  if (service.basic_auth_enabled) return `Basic(${service.basic_auth_user_count})`;
  return "없음";
}

function getAuthClassName(service: Service) {
  if (service.auth_mode === "token") return "bg-purple-100 text-purple-700";
  if (service.auth_mode !== "none" || service.basic_auth_enabled) return "bg-blue-100 text-blue-700";
  return "bg-gray-100 text-gray-500";
}

function getRouterStatusLabel(active: boolean | undefined) {
  if (active === undefined) return "확인 중";
  return active ? "연결됨" : "미연결";
}

function getRouterStatusClassName(active: boolean | undefined) {
  if (active === undefined) return "bg-gray-100 text-gray-500";
  return active ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700";
}
