import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import type {
  DeploymentComponent,
  DeploymentInfo,
} from "@/features/deployment/api/deploymentApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

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
  const watchdogStaleMinutes = deployment?.external_watchdog_stale_after_minutes ?? 10;
  const httpMonitor = deployment?.http_error_monitor;
  const httpErrorsBreached = Boolean(
    httpMonitor?.enabled && httpMonitor.available && httpMonitor.breached,
  );
  const httpMonitorUnavailable = Boolean(
    httpMonitor?.enabled && httpMonitor.checked_at && !httpMonitor.available,
  );
  if (
    unhealthyComponents.length === 0 &&
    !watchdogUnhealthy &&
    !watchdogStale &&
    !httpErrorsBreached &&
    !httpMonitorUnavailable
  ) return null;

  const critical = unhealthyComponents.length > 0 || watchdogUnhealthy || httpErrorsBreached;
  const details = unhealthyComponents.map(getFailureDetail);
  if (watchdogUnhealthy) {
    details.push(
      `외부 watchdog 연속 실패 ${deployment?.external_watchdog_consecutive_failures ?? 0}회`,
    );
  }
  if (watchdogStale) {
    details.push(`외부 watchdog 실행이 ${watchdogStaleMinutes}분 이상 지연됨`);
  }
  if (httpErrorsBreached && httpMonitor) {
    details.push(
      `Manager API 임계치 초과 (404 ${httpMonitor.not_found_count}/${httpMonitor.not_found_threshold} · 5xx ${httpMonitor.server_error_count}/${httpMonitor.server_error_threshold})`,
    );
  }
  if (httpMonitorUnavailable) {
    details.push("Manager API 오류 점검 실패");
  }

  return (
    <div
      className={`mb-4 rounded-lg border px-4 py-3 sm:mb-6 ${
        critical
          ? "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100"
          : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
      }`}
      data-manager-api-alert={
        httpErrorsBreached ? "breached" : httpMonitorUnavailable ? "unavailable" : "none"
      }
      data-testid="manager-health-alert-banner"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {critical ? "Manager 상태 이상" : "Manager 상태 확인 필요"}
          </p>
          <p className="mt-1 text-xs">{details.join(" / ")}</p>
          <p className="mt-1 text-xs opacity-80">
            마지막 상태 갱신: {formatDateTime(updatedAt, timezone)}
            {deployment?.external_watchdog_checked_at
              ? ` · watchdog 실행: ${formatDateTime(deployment.external_watchdog_checked_at, timezone)}`
              : ""}
            {httpMonitor?.checked_at
              ? ` · API 점검: ${formatDateTime(httpMonitor.checked_at, timezone)}`
              : ""}
          </p>
          {httpErrorsBreached || httpMonitorUnavailable ? (
            <Link
              className="mt-2 inline-flex text-xs font-semibold underline underline-offset-2 hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              data-testid="manager-api-audit-link"
              href="/dashboard/audit?filter=manager_health&manager_source=api&period=1&expand=latest"
            >
              관련 감사 로그 보기
            </Link>
          ) : null}
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
