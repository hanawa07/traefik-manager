import type { ManagerDeploymentHistoryEntry } from "@/features/deployment/api/deploymentApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

import {
  getExternalWatchdogRunLabel,
  getHostOperationAlertChannelLabel,
  isExternalWatchdogRunFailure,
} from "./managerWatchdogStatus";

interface ManagerDeploymentAlertRunProps {
  entry: ManagerDeploymentHistoryEntry;
  timezone?: string;
}

export function ManagerDeploymentAlertRun({
  entry,
  timezone,
}: ManagerDeploymentAlertRunProps) {
  if (entry.alert_request_status === "not_needed") return null;

  const requestFailed = entry.alert_request_status === "request_failed";
  const runFailed = isExternalWatchdogRunFailure(entry.alert_run_conclusion);
  const resultChecked = Boolean(
    entry.alert_run_status || entry.alert_run_checked_at || entry.alert_run_error,
  );
  const resultLabel = resultChecked
    ? getExternalWatchdogRunLabel(
        entry.alert_run_status,
        entry.alert_run_conclusion,
        entry.alert_run_error,
      )
    : "결과 조회 대기";
  const tone = requestFailed || runFailed
    ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200"
    : entry.alert_run_error
      ? "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-100"
      : "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200";

  return (
    <p
      className={`mt-2 rounded-md px-2 py-1.5 text-[11px] font-medium ${tone}`}
      data-deployment-alert-run={entry.alert_request_status}
    >
      {requestFailed ? "운영 알림 요청 실패" : "운영 알림 요청됨"}
      {entry.alert_run_url ? (
        <>
          {" · "}
          <a
            className="font-semibold underline underline-offset-2 hover:text-blue-900 dark:hover:text-white"
            href={entry.alert_run_url}
            rel="noreferrer"
            target="_blank"
          >
            알림 실행 {resultLabel}
          </a>
        </>
      ) : requestFailed ? null : entry.alert_channel ? (
        ` · 전송 경로: ${getHostOperationAlertChannelLabel(entry.alert_channel)}`
      ) : " · 전송 경로 미확인"}
      {entry.alert_run_checked_at
        ? ` · 확인 ${formatDateTime(entry.alert_run_checked_at, timezone)}`
        : ""}
      {entry.alert_run_error ? ` · ${entry.alert_run_error}` : ""}
    </p>
  );
}
