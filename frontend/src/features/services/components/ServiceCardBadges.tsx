import type { Certificate } from "@/features/certificates/api/certificateApi";
import type { Service, ServiceGatewayDiagnosis, UpstreamHealth } from "../api/serviceApi";
import { ServiceCardCertificateBadge } from "./ServiceCardCertificateBadge";
import { ServiceCardDiagnosisBadge } from "./ServiceCardDiagnosisBadge";
import { ServiceCardHealthBadges } from "./ServiceCardHealthBadges";
import { ServiceCardMiddlewareBadge } from "./ServiceCardMiddlewareBadge";
import { ServiceCardRoutingModeBadge } from "./ServiceCardRoutingModeBadge";
import { ServiceCardSecurityBadges } from "./ServiceCardSecurityBadges";

interface ServiceCardBadgesProps {
  service: Service;
  routerActive?: boolean;
  upstreamHealth?: UpstreamHealth;
  certificate?: Certificate;
  lastGatewayDiagnosis?: ServiceGatewayDiagnosis | null;
}

export default function ServiceCardBadges({
  service,
  routerActive,
  upstreamHealth,
  certificate,
  lastGatewayDiagnosis,
}: ServiceCardBadgesProps) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4 dark:border-slate-800">
      <ServiceCardRoutingModeBadge
        routingMode={service.routing_mode}
        maintenanceUntil={service.maintenance_until}
      />
      <ServiceCardSecurityBadges service={service} />
      <ServiceCardCertificateBadge service={service} certificate={certificate} />
      <ServiceCardMiddlewareBadge service={service} />
      {service.routing_mode === "active" ? (
        <>
          <ServiceCardHealthBadges routerActive={routerActive} upstreamHealth={upstreamHealth} />
          <ServiceCardDiagnosisBadge diagnosis={lastGatewayDiagnosis} />
        </>
      ) : null}
    </div>
  );
}
