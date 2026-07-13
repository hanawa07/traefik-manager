"use client";

import { useState } from "react";

import {
  useAuditCertificateSummary,
  useAuditSecuritySummary,
  useManagerHealthAudit,
} from "@/features/audit/hooks/useAudit";
import { useAuthStore } from "@/features/auth/store/useAuthStore";
import { useCertificates } from "@/features/certificates/hooks/useCertificates";
import { useDeploymentInfo, useRefreshDeploymentLatest } from "@/features/deployment/hooks/useDeploymentInfo";
import { useAllServicesHealth, useServices } from "@/features/services/hooks/useServices";
import { useTimeDisplaySettings } from "@/features/settings/hooks/useSettings";
import {
  useRefreshTraefikLatest,
  useTraefikDeployment,
  useTraefikHealth,
  useTraefikRouterStatus,
} from "@/features/traefik/hooks/useTraefik";
import { CertificateAlertSummaryCard } from "./CertificateAlertSummaryCard";
import { DashboardServicesTable } from "./DashboardServicesTable";
import { ManagerDeploymentCard } from "./ManagerDeploymentCard";
import { ManagerHealthAlertBanner } from "./ManagerHealthAlertBanner";
import { ManagerHealthHistoryCard } from "./ManagerHealthHistoryCard";
import { SecurityAlertSummaryCard } from "./SecurityAlertSummaryCard";
import { ServiceOverviewStats } from "./ServiceOverviewStats";
import { TraefikStatusBanner } from "./TraefikStatusBanner";

export default function DashboardPage() {
  const [lastDeploymentManualRefreshAt, setLastDeploymentManualRefreshAt] = useState<string>();
  const role = useAuthStore((state) => state.role);
  const canManage = role === "admin";
  const { data: services = [], isLoading } = useServices();
  const { data: healthData = {} } = useAllServicesHealth();
  const { data: traefikHealth } = useTraefikHealth();
  const { data: traefikDeployment } = useTraefikDeployment();
  const refreshTraefikLatest = useRefreshTraefikLatest();
  const { data: routerStatus } = useTraefikRouterStatus();
  const { data: securitySummary } = useAuditSecuritySummary({ recent_limit: 3 });
  const { data: certificateSummary } = useAuditCertificateSummary({ recent_limit: 3 });
  const {
    data: managerHealthLogs = [],
    isError: isManagerHealthHistoryError,
    isLoading: isManagerHealthHistoryLoading,
  } = useManagerHealthAudit();
  const { data: timeDisplaySettings } = useTimeDisplaySettings();
  const { data: certificates = [] } = useCertificates();
  const {
    data: deploymentInfo,
    dataUpdatedAt: deploymentUpdatedAt,
    isFetching: isRefreshingDeploymentStatus,
    refetch: refreshDeploymentStatus,
  } = useDeploymentInfo();
  const refreshDeploymentLatest = useRefreshDeploymentLatest();

  const totalServices = services.length;
  const authEnabled = services.filter((s) => s.auth_mode !== "none" || s.basic_auth_enabled).length;
  const tlsEnabled = services.filter((s) => s.tls_enabled).length;
  const noAuth = services.filter((s) => s.auth_mode === "none" && !s.basic_auth_enabled).length;
  const upStreamUpCount = Object.values(healthData).filter((h) => h.status === "up").length;
  const displayTimezone = timeDisplaySettings?.display_timezone;
  const deploymentUpdatedAtIso = deploymentUpdatedAt
    ? new Date(deploymentUpdatedAt).toISOString()
    : undefined;
  const handleRefreshDeploymentStatus = async () => {
    const result = await refreshDeploymentStatus();
    if (result.isSuccess) setLastDeploymentManualRefreshAt(new Date().toISOString());
  };

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">대시보드</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Traefik 서비스 현황</p>
      </div>

      <ManagerHealthAlertBanner
        deployment={deploymentInfo}
        updatedAt={deploymentUpdatedAtIso}
        timezone={displayTimezone}
      />
      <TraefikStatusBanner
        deployment={traefikDeployment}
        health={traefikHealth}
        isRefreshingLatest={refreshTraefikLatest.isPending}
        onRefreshLatest={() => refreshTraefikLatest.mutate()}
        refreshLatestError={refreshTraefikLatest.isError ? "최신 Traefik 버전을 다시 확인하지 못했습니다" : null}
        timezone={displayTimezone}
      />
      <ManagerDeploymentCard
        deployment={deploymentInfo}
        isRefreshingLatest={refreshDeploymentLatest.isPending}
        isRefreshingStatus={isRefreshingDeploymentStatus}
        lastManualRefreshAt={lastDeploymentManualRefreshAt}
        onRefreshLatest={() => refreshDeploymentLatest.mutate()}
        onRefreshStatus={() => void handleRefreshDeploymentStatus()}
        refreshLatestError={refreshDeploymentLatest.isError ? "최신 릴리즈를 다시 확인하지 못했습니다" : null}
        statusUpdatedAt={deploymentUpdatedAtIso}
        timezone={displayTimezone}
      />
      <ManagerHealthHistoryCard
        isError={isManagerHealthHistoryError}
        isLoading={isManagerHealthHistoryLoading}
        logs={managerHealthLogs}
        timezone={displayTimezone}
      />
      <SecurityAlertSummaryCard summary={securitySummary} timezone={displayTimezone} />
      <CertificateAlertSummaryCard certificates={certificates} summary={certificateSummary} timezone={displayTimezone} />
      <ServiceOverviewStats
        isLoading={isLoading}
        totalServices={totalServices}
        upstreamUpCount={upStreamUpCount}
        authEnabled={authEnabled}
        tlsEnabled={tlsEnabled}
        noAuth={noAuth}
      />
      <DashboardServicesTable
        canManage={canManage}
        isLoading={isLoading}
        services={services}
        routerStatus={routerStatus}
      />
    </div>
  );
}
