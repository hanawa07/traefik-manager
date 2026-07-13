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

export function getExternalWatchdogRunLabel(
  status?: string | null,
  conclusion?: string | null,
  error?: string | null,
) {
  if (!status) return error ? "확인 실패" : "기록 없음";
  if (status === "queued" || status === "requested" || status === "waiting" || status === "pending") {
    return "대기 중";
  }
  if (status === "in_progress") return "진행 중";
  if (status !== "completed") return status;

  const labels: Record<string, string> = {
    action_required: "조치 필요",
    cancelled: "취소",
    failure: "실패",
    neutral: "중립",
    skipped: "건너뜀",
    stale: "만료",
    startup_failure: "시작 실패",
    success: "성공",
    timed_out: "시간 초과",
  };
  return conclusion ? labels[conclusion] || conclusion : "완료";
}

export function isExternalWatchdogRunFailure(conclusion?: string | null) {
  return ["action_required", "cancelled", "failure", "stale", "startup_failure", "timed_out"].includes(
    conclusion || "",
  );
}
