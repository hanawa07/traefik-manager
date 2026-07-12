import { AlertTriangle } from "lucide-react";

import type { DeploymentComponent } from "@/features/deployment/api/deploymentApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

interface ManagerHealthAlertBannerProps {
  components?: DeploymentComponent[];
  updatedAt?: string;
  timezone?: string;
}

export function ManagerHealthAlertBanner({
  components = [],
  updatedAt,
  timezone,
}: ManagerHealthAlertBannerProps) {
  const unhealthyComponents = components.filter(isUnhealthy);
  if (unhealthyComponents.length === 0) return null;

  return (
    <div
      className="mb-4 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-rose-900 sm:mb-6 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100"
      data-testid="manager-health-alert-banner"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">Manager Docker 이상 상태</p>
          <p className="mt-1 text-xs">
            {unhealthyComponents.map((component) => component.name).join(", ")} ·{" "}
            {unhealthyComponents.map(getFailureDetail).join(" / ")}
          </p>
          <p className="mt-1 text-xs text-rose-700 dark:text-rose-200">
            마지막 상태 갱신: {formatDateTime(updatedAt, timezone)}
          </p>
        </div>
      </div>
    </div>
  );
}

function isUnhealthy(component: DeploymentComponent) {
  return (
    component.status === "unavailable" ||
    (Boolean(component.runtime_status) && component.runtime_status !== "running") ||
    component.health_status === "unhealthy"
  );
}

function getFailureDetail(component: DeploymentComponent) {
  if (component.status === "unavailable") return `${component.name} 조회 실패`;
  if (component.runtime_status && component.runtime_status !== "running") {
    return `${component.name} ${component.runtime_status}`;
  }
  return `${component.name} 연속 실패 ${component.health_failing_streak}회`;
}
