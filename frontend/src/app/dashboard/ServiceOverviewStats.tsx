import { Activity, AlertTriangle, Lock, Server, Shield } from "lucide-react";

import { DashboardStatCard } from "./DashboardStatCard";

interface ServiceOverviewStatsProps {
  isLoading: boolean;
  totalServices: number;
  upstreamUpCount: number;
  authEnabled: number;
  tlsEnabled: number;
  noAuth: number;
}

export function ServiceOverviewStats({
  isLoading,
  totalServices,
  upstreamUpCount,
  authEnabled,
  tlsEnabled,
  noAuth,
}: ServiceOverviewStatsProps) {
  if (isLoading) {
    return (
      <div
        className="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:gap-4 lg:grid-cols-5"
        data-testid="service-overview-stats"
      >
        {[...Array(5)].map((_, index) => (
          <div
            key={index}
            className={`card h-20 animate-pulse p-3 sm:p-5 dark:bg-slate-900 ${index === 4 ? "col-span-2 lg:col-span-1" : ""}`}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:gap-4 lg:grid-cols-5"
      data-testid="service-overview-stats"
    >
      <DashboardStatCard icon={Server} label="전체 서비스" value={totalServices} color="bg-blue-500" />
      <DashboardStatCard icon={Activity} label="업스트림 정상" value={upstreamUpCount} color="bg-emerald-500" />
      <DashboardStatCard icon={Lock} label="인증 활성" value={authEnabled} color="bg-green-500" />
      <DashboardStatCard icon={Shield} label="HTTPS 활성" value={tlsEnabled} color="bg-indigo-500" />
      <DashboardStatCard
        className="col-span-2 lg:col-span-1"
        icon={AlertTriangle}
        label="인증 없는 서비스"
        value={noAuth}
        color="bg-amber-500"
      />
    </div>
  );
}
