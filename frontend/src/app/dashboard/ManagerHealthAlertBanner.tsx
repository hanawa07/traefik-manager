import { AlertTriangle } from "lucide-react";

import type {
  DeploymentComponent,
  DeploymentInfo,
} from "@/features/deployment/api/deploymentApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import { EXTERNAL_WATCHDOG_STALE_MINUTES } from "./managerWatchdogStatus";

interface ManagerHealthAlertBannerProps {
  deployment?: DeploymentInfo;
  updatedAt?: string;
  timezone?: string;
}

export function ManagerHealthAlertBanner({
  deployment,
  updatedAt,
  timezone,
}: ManagerHealthAlertBannerProps) {
  const unhealthyComponents = (deployment?.components ?? []).filter(isUnhealthy);
  const watchdogUnhealthy = deployment?.external_watchdog_status === "unhealthy";
  const watchdogStale = deployment?.external_watchdog_stale === true;
  if (unhealthyComponents.length === 0 && !watchdogUnhealthy && !watchdogStale) return null;

  const critical = unhealthyComponents.length > 0 || watchdogUnhealthy;
  const details = unhealthyComponents.map(getFailureDetail);
  if (watchdogUnhealthy) {
    details.push(
      `외부 watchdog 연속 실패 ${deployment?.external_watchdog_consecutive_failures ?? 0}회`,
    );
  }
  if (watchdogStale) {
    details.push(`외부 watchdog 실행이 ${EXTERNAL_WATCHDOG_STALE_MINUTES}분 이상 지연됨`);
  }

  return (
    <div
      className={`mb-4 rounded-lg border px-4 py-3 sm:mb-6 ${
        critical
          ? "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100"
          : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
      }`}
      data-testid="manager-health-alert-banner"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {critical ? "Manager 상태 이상" : "외부 watchdog 갱신 지연"}
          </p>
          <p className="mt-1 text-xs">{details.join(" / ")}</p>
          <p className="mt-1 text-xs opacity-80">
            마지막 상태 갱신: {formatDateTime(updatedAt, timezone)}
            {deployment?.external_watchdog_checked_at
              ? ` · watchdog 실행: ${formatDateTime(deployment.external_watchdog_checked_at, timezone)}`
              : ""}
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
