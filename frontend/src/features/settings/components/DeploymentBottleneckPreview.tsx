import type { DeploymentBottleneckPreview as PreviewValue } from "@/features/deployment/lib/deploymentBottleneckPreview";
import {
  MANAGER_DEPLOYMENT_STAGE_LABELS,
  formatManagerDeploymentDurationMs,
} from "@/features/deployment/lib/managerDeploymentDisplay";

export function DeploymentBottleneckPreview({
  isError,
  isLoading,
  preview,
  requiredCount,
}: {
  isError: boolean;
  isLoading: boolean;
  preview?: PreviewValue;
  requiredCount: number;
}) {
  const message = isLoading
    ? "최근 배포 이력을 불러오는 중입니다."
    : isError || !preview
      ? "최근 배포 이력을 불러오지 못해 예상 결과를 계산할 수 없습니다."
      : !preview.hasHistory
        ? "기록된 최근 배포가 없어 아직 계산할 수 없습니다."
        : preview.wouldAlert
          ? `현재 이력에 적용하면 알림 조건을 충족합니다. 연속 ${preview.currentCount}/${requiredCount}회`
          : `현재 이력 기준 연속 ${preview.currentCount}/${requiredCount}회 · ${preview.remainingCount}회 더 필요`;

  return (
    <div
      className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs text-orange-800 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-100"
      data-deployment-bottleneck-preview={preview?.wouldAlert ? "alert" : "pending"}
    >
      <p className="font-semibold">최근 배포 기준 예상 결과</p>
      <p className="mt-1">{message}</p>
      {preview?.slowestStage ? (
        <p className="mt-1 opacity-80">
          최근 {preview.latestVersion} · {MANAGER_DEPLOYMENT_STAGE_LABELS[preview.slowestStage]} 최대 {formatManagerDeploymentDurationMs(preview.slowestMs)}
        </p>
      ) : null}
    </div>
  );
}
