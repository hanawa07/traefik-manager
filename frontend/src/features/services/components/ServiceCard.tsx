"use client";
import type { Certificate } from "@/features/certificates/api/certificateApi";
import type { Service, ServiceGatewayDiagnosis, UpstreamHealth } from "../api/serviceApi";
import ServiceCardBadges from "./ServiceCardBadges";
import ServiceCardDiagnosisHistory from "./ServiceCardDiagnosisHistory";
import ServiceGatewayDiagnosisPanel from "./ServiceGatewayDiagnosisPanel";
import ServiceCardHeader from "./ServiceCardHeader";
import ServiceCardHealthDetails from "./ServiceCardHealthDetails";

interface ServiceCardProps {
  service: Service;
  onDelete: (service: Service) => void;
  routerActive?: boolean;
  canManage?: boolean;
  upstreamHealth?: UpstreamHealth;
  displayTimeZone?: string | null;
  lastSuccessAt?: string | null;
  lastFailureAt?: string | null;
  certificate?: Certificate;
  lastGatewayDiagnosis?: ServiceGatewayDiagnosis | null;
  gatewayDiagnosisHistory?: ServiceGatewayDiagnosis[];
}

export default function ServiceCard({
  service,
  onDelete,
  routerActive,
  canManage = true,
  upstreamHealth,
  displayTimeZone,
  lastSuccessAt,
  lastFailureAt,
  certificate,
  gatewayDiagnosisHistory,
  lastGatewayDiagnosis,
}: ServiceCardProps) {
  const isActive = service.routing_mode === "active";
  return (
    <div
      className="card p-5 transition-shadow hover:shadow-md"
      data-routing-mode={service.routing_mode}
      data-service-id={service.id}
    >
      <ServiceCardHeader service={service} canManage={canManage} onDelete={onDelete} />
      <ServiceCardBadges
        service={service}
        routerActive={routerActive}
        upstreamHealth={upstreamHealth}
        certificate={certificate}
        lastGatewayDiagnosis={lastGatewayDiagnosis}
      />
      {isActive ? (
        <>
          <ServiceCardDiagnosisHistory history={gatewayDiagnosisHistory} displayTimeZone={displayTimeZone} />
          <ServiceCardHealthDetails
            upstreamHealth={upstreamHealth}
            certificate={certificate}
            displayTimeZone={displayTimeZone}
            lastSuccessAt={lastSuccessAt}
            lastFailureAt={lastFailureAt}
          />
          <ServiceGatewayDiagnosisPanel service={service} canManage={canManage} />
        </>
      ) : null}
    </div>
  );
}
