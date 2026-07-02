import type { Service, UpstreamHealth } from "@/features/services/api/serviceApi";

export function getHealthWeight(
  service: Service,
  healthMap?: Record<string, UpstreamHealth>,
) {
  const status = healthMap?.[service.id]?.status;
  if (status === "down") return 2;
  if (status === "unknown" || status === undefined) return 1;
  return 0;
}
