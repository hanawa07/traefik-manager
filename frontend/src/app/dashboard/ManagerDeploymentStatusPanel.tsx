import type { DeploymentInfo } from "@/features/deployment/api/deploymentApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

import {
  getExternalWatchdogAlertLabel,
  getExternalWatchdogLabel,
  getExternalWatchdogRunLabel,
  isExternalWatchdogRunFailure,
} from "./managerWatchdogStatus";

interface ManagerDeploymentStatusPanelProps {
  consistencyMessage?: string;
  deployment?: DeploymentInfo;
  panelClassName: string;
  refreshLatestError?: string | null;
  releaseMessage?: string;
  statusUpdatedAt?: string;
  timezone?: string;
}

export function ManagerDeploymentStatusPanel({
  consistencyMessage,
  deployment,
  panelClassName,
  refreshLatestError,
  releaseMessage,
  statusUpdatedAt,
  timezone,
}: ManagerDeploymentStatusPanelProps) {
  const latestCheckedAt = formatDateTime(deployment?.latest_version_checked_at, timezone);
  const watchdogCheckedAt = formatDateTime(deployment?.external_watchdog_checked_at, timezone);
  const watchdogStaleMinutes = deployment?.external_watchdog_stale_after_minutes ?? 10;
  const watchdogLastAlertAt = formatDateTime(deployment?.external_watchdog_last_alert_at, timezone);
  const watchdogRunCheckedAt = formatDateTime(
    deployment?.external_watchdog_last_alert_run_checked_at,
    timezone,
  );

  return (
    <div className={`mt-4 rounded-xl border px-4 py-3 text-xs ${panelClassName}`}>
      <p className="font-medium">{deployment?.message || "배포 정보를 확인하는 중입니다"}</p>
      {consistencyMessage ? <p className="mt-1 font-semibold">{consistencyMessage}</p> : null}
      {refreshLatestError ? <p className="mt-1 font-semibold text-red-700 dark:text-red-200">{refreshLatestError}</p> : null}
      {releaseMessage ? <p className="mt-1">{releaseMessage}</p> : null}
      <p className="mt-1">
        최신 릴리즈 확인: {latestCheckedAt}
        {deployment?.latest_version_error ? ` · ${deployment.latest_version_error}` : ""}
      </p>
      <p className="mt-1">마지막 상태 갱신: {formatDateTime(statusUpdatedAt, timezone)} · 30초 자동 갱신</p>
      <p className="mt-1">
        외부 watchdog: {getExternalWatchdogLabel(deployment?.external_watchdog_status)}
        {deployment?.external_watchdog_stale
          ? ` (${watchdogStaleMinutes}분 이상 갱신 없음)`
          : ""}
        {" · "}연속 실패 {deployment?.external_watchdog_consecutive_failures ?? 0}회 · 마지막 실행: {watchdogCheckedAt}
      </p>
      <p
        className={`mt-1 ${
          deployment?.external_watchdog_last_alert_success === false
            ? "font-semibold text-red-700 dark:text-red-200"
            : ""
        }`}
      >
        최근 watchdog 알림 요청: {getExternalWatchdogAlertLabel(
          deployment?.external_watchdog_last_alert_event,
          deployment?.external_watchdog_last_alert_success,
        )} · 요청 시각: {watchdogLastAlertAt}
        {deployment?.external_watchdog_last_alert_run_url ? (
          <>
            {" · "}
            <a
              className="font-semibold underline underline-offset-2"
              href={deployment.external_watchdog_last_alert_run_url}
              rel="noreferrer"
              target="_blank"
            >
              실행 보기
            </a>
          </>
        ) : null}
      </p>
      <p
        className={`mt-1 ${
          isExternalWatchdogRunFailure(deployment?.external_watchdog_last_alert_run_conclusion)
            ? "font-semibold text-red-700 dark:text-red-200"
            : ""
        }`}
      >
        알림 워크플로 결과: {getExternalWatchdogRunLabel(
          deployment?.external_watchdog_last_alert_run_status,
          deployment?.external_watchdog_last_alert_run_conclusion,
          deployment?.external_watchdog_last_alert_run_error,
        )} · 확인 시각: {watchdogRunCheckedAt}
        {deployment?.external_watchdog_last_alert_run_error
          ? ` · ${deployment.external_watchdog_last_alert_run_error}`
          : ""}
      </p>
    </div>
  );
}
