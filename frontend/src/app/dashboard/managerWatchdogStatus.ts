import type { DeploymentInfo } from "@/features/deployment/api/deploymentApi";

export function getExternalWatchdogLabel(
  status?: DeploymentInfo["external_watchdog_status"],
) {
  if (status === "healthy") return "정상";
  if (status === "unhealthy") return "장애 감지";
  return "확인 불가";
}

export function getExternalWatchdogAlertLabel(
  event?: DeploymentInfo["external_watchdog_last_alert_event"],
  success?: DeploymentInfo["external_watchdog_last_alert_success"],
) {
  if (!event || success == null) return "기록 없음";
  const eventLabel = event === "failure" ? "장애" : "복구";
  return `${eventLabel} 알림 워크플로 요청 ${success ? "성공" : "실패"}`;
}
