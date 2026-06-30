"use client";

import { useCertificates } from "@/features/certificates/hooks/useCertificates";
import { useAllServicesHealth, useServices } from "@/features/services/hooks/useServices";
import { useTimeDisplaySettings } from "@/features/settings/hooks/useSettings";
import { useTraefikRouterStatus } from "@/features/traefik/hooks/useTraefik";

export function useServicesPageData() {
  const { data: services = [], isLoading } = useServices();
  const { data: routerStatus } = useTraefikRouterStatus();
  const { data: healthMap } = useAllServicesHealth();
  const { data: certificates = [] } = useCertificates();
  const { data: timeDisplaySettings } = useTimeDisplaySettings();

  return {
    certificates,
    displayTimeZone: timeDisplaySettings?.display_timezone,
    healthMap,
    isLoading,
    routerStatus,
    services,
  };
}
