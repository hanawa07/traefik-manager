import type { Certificate } from "@/features/certificates/api/certificateApi";
import type { Service, UpstreamHealth } from "@/features/services/api/serviceApi";
import ServiceCard from "@/features/services/components/ServiceCard";
import type { TraefikRouterStatus } from "@/features/traefik/api/traefikApi";
import { ServicesEmptyState } from "./ServicesEmptyState";
import { ServicesLoadingGrid } from "./ServicesLoadingGrid";
import type { ServiceDiagnosisHistoryMap } from "./serviceGatewayDiagnosisAuditSnapshots";
import type { ServiceDiagnosisSnapshotMap } from "./serviceSaveDiagnosis";
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
  diagnosisHistories: ServiceDiagnosisHistoryMap;
  diagnosisSnapshots: ServiceDiagnosisSnapshotMap;
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
  diagnosisHistories,
  diagnosisSnapshots,
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
          gatewayDiagnosisHistory={diagnosisHistories[service.id]}
          lastGatewayDiagnosis={diagnosisSnapshots[service.id]?.diagnosis}
        />
      ))}
    </div>
  );
}
