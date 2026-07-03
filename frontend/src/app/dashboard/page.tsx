"use client";

import { useAuditCertificateSummary, useAuditSecuritySummary } from "@/features/audit/hooks/useAudit";
import { useAuthStore } from "@/features/auth/store/useAuthStore";
import { useCertificates } from "@/features/certificates/hooks/useCertificates";
import { useDeploymentInfo } from "@/features/deployment/hooks/useDeploymentInfo";
import { useAllServicesHealth, useServices } from "@/features/services/hooks/useServices";
import { useTimeDisplaySettings } from "@/features/settings/hooks/useSettings";
import { useTraefikHealth, useTraefikRouterStatus } from "@/features/traefik/hooks/useTraefik";
import { CertificateAlertSummaryCard } from "./CertificateAlertSummaryCard";
import { DashboardServicesTable } from "./DashboardServicesTable";
import { ManagerDeploymentCard } from "./ManagerDeploymentCard";
import { SecurityAlertSummaryCard } from "./SecurityAlertSummaryCard";
import { ServiceOverviewStats } from "./ServiceOverviewStats";
import { TraefikStatusBanner } from "./TraefikStatusBanner";

export default function DashboardPage() {
  const role = useAuthStore((state) => state.role);
  const canManage = role === "admin";
  const { data: services = [], isLoading } = useServices();
  const { data: healthData = {} } = useAllServicesHealth();
  const { data: traefikHealth } = useTraefikHealth();
  const { data: routerStatus } = useTraefikRouterStatus();
  const { data: securitySummary } = useAuditSecuritySummary({ recent_limit: 3 });
  const { data: certificateSummary } = useAuditCertificateSummary({ recent_limit: 3 });
  const { data: timeDisplaySettings } = useTimeDisplaySettings();
  const { data: certificates = [] } = useCertificates();
  const { data: deploymentInfo } = useDeploymentInfo();

  const totalServices = services.length;
  const authEnabled = services.filter((s) => s.auth_mode !== "none" || s.basic_auth_enabled).length;
  const tlsEnabled = services.filter((s) => s.tls_enabled).length;
  const noAuth = services.filter((s) => s.auth_mode === "none" && !s.basic_auth_enabled).length;
  const upStreamUpCount = Object.values(healthData).filter((h) => h.status === "up").length;
  const displayTimezone = timeDisplaySettings?.display_timezone;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="text-gray-500 text-sm mt-1">Traefik 서비스 현황</p>
      </div>

      <TraefikStatusBanner health={traefikHealth} timezone={displayTimezone} />
      <ManagerDeploymentCard deployment={deploymentInfo} timezone={displayTimezone} />
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
