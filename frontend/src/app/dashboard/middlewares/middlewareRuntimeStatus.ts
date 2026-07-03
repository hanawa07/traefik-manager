import type { TraefikMiddlewareItem } from "@/features/traefik/api/traefikApi";

import type { BadgeStatus } from "./middlewareGeneratedHelpers";

export function mapRuntimeStatus(
  runtime: TraefikMiddlewareItem | undefined,
  {
    runtimeConnected,
    missingStatus = "warning",
  }: {
    runtimeConnected: boolean;
    missingStatus?: BadgeStatus;
  },
): BadgeStatus {
  if (!runtimeConnected) return "pending";
  if (!runtime) return missingStatus;

  const normalized = runtime.status.toLowerCase();
  if (normalized === "enabled") return "active";
  if (normalized === "disabled") return "inactive";
  if (normalized === "error") return "error";
  return "warning";
}

export function formatRuntimeStatusLabel(
  runtime: TraefikMiddlewareItem | undefined,
  runtimeConnected: boolean,
) {
  return runtimeConnected ? runtime?.status || "runtime 미발견" : "Traefik 연결 확인 중";
}
