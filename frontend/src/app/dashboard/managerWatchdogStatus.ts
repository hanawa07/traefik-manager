import type { DeploymentInfo } from "@/features/deployment/api/deploymentApi";

export const EXTERNAL_WATCHDOG_STALE_MINUTES = 10;

export function getExternalWatchdogLabel(
  status?: DeploymentInfo["external_watchdog_status"],
) {
  if (status === "healthy") return "정상";
  if (status === "unhealthy") return "장애 감지";
  return "확인 불가";
}
