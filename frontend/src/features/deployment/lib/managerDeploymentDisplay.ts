import type { ManagerDeploymentStage } from "../api/deploymentApi";

export const MANAGER_DEPLOYMENT_STAGE_LABELS: Record<ManagerDeploymentStage, string> = {
  prepare: "사전 준비",
  build: "이미지 빌드",
  migration_preflight: "DB migration 사전 검사",
  candidate_health: "후보 컨테이너 준비",
  route_switch: "Traefik route 전환",
  leader_handover: "background leader 승계",
  public_probe: "공개 health probe",
  state_write: "배포 상태 확정",
};

export function formatManagerDeploymentDurationMs(durationMs: number): string {
  if (durationMs < 1_000) return "1초 미만";

  const totalSeconds = Math.floor(durationMs / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}시간${minutes > 0 ? ` ${minutes}분` : ""}`;
  if (minutes > 0) return `${minutes}분${seconds > 0 ? ` ${seconds}초` : ""}`;
  return `${seconds}초`;
}

export function getManagerDeploymentDurationMs(
  startedAt: string,
  completedAt: string,
): number | null {
  const durationMs = Date.parse(completedAt) - Date.parse(startedAt);
  return Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : null;
}
