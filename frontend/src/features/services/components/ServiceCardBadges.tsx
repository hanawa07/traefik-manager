import type { Certificate } from "@/features/certificates/api/certificateApi";
import type { Service, UpstreamHealth } from "../api/serviceApi";
import { ServiceCardCertificateBadge } from "./ServiceCardCertificateBadge";
import { ServiceCardHealthBadges } from "./ServiceCardHealthBadges";
import { ServiceCardMiddlewareBadge } from "./ServiceCardMiddlewareBadge";
import { ServiceCardSecurityBadges } from "./ServiceCardSecurityBadges";

interface ServiceCardBadgesProps {
  service: Service;
  routerActive?: boolean;
  upstreamHealth?: UpstreamHealth;
  certificate?: Certificate;
}

export default function ServiceCardBadges({
  service,
  routerActive,
  upstreamHealth,
  certificate,
}: ServiceCardBadgesProps) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
      <ServiceCardSecurityBadges service={service} />
      <ServiceCardCertificateBadge service={service} certificate={certificate} />
      <ServiceCardMiddlewareBadge service={service} />
      <ServiceCardHealthBadges routerActive={routerActive} upstreamHealth={upstreamHealth} />
    </div>
  );
}
