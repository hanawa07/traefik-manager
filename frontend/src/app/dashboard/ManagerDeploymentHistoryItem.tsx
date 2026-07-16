import type { ManagerDeploymentHistoryEntry } from "@/features/deployment/api/deploymentApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

import {
  formatManagerDeploymentDuration,
  MANAGER_DEPLOYMENT_FAILURE_STAGE_LABELS,
  MANAGER_DEPLOYMENT_STATUS_DISPLAY,
} from "./managerDeploymentHistoryDisplay";
import { buildManagerDeploymentLinks } from "./managerDeploymentLinks";
import {
  getExternalWatchdogRunLabel,
  isExternalWatchdogRunFailure,
} from "./managerWatchdogStatus";

interface ManagerDeploymentHistoryItemProps {
  entry: ManagerDeploymentHistoryEntry;
  searchText: string;
  source?: string | null;
  timezone?: string;
}

export function ManagerDeploymentHistoryItem({
  entry,
  searchText,
  source,
  timezone,
}: ManagerDeploymentHistoryItemProps) {
  const status = MANAGER_DEPLOYMENT_STATUS_DISPLAY[entry.status];
  const duration = formatManagerDeploymentDuration(entry.started_at, entry.completed_at);
  const links = buildManagerDeploymentLinks({
    latestVersion: entry.version,
    revision: entry.revision,
    source,
  });
  const revision = entry.revision.slice(0, 12);

  return (
    <li
      className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900"
      data-deployment-failure-stage={entry.failure_stage ?? (entry.status === "success" ? undefined : "unknown")}
      data-deployment-status={entry.status}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>
          {status.label}
        </span>
        <span
          className="text-xs font-semibold text-gray-800 dark:text-slate-200"
          data-deployment-slot-summary
        >
          전환 {entry.from_slot} → {entry.to_slot} · 최종 활성 {entry.active_slot}
        </span>
      </div>
      <p className="mt-2 text-xs text-gray-600 dark:text-slate-300">
        {links.releaseUrl ? (
          <a
            className="font-semibold underline decoration-gray-300 underline-offset-2 hover:text-blue-700 dark:decoration-slate-600 dark:hover:text-blue-300"
            href={links.releaseUrl}
            rel="noreferrer"
            target="_blank"
          >
            <HighlightedText query={searchText} text={entry.version} />
          </a>
        ) : (
          <HighlightedText query={searchText} text={entry.version} />
        )}
        {" · "}
        {links.commitUrl ? (
          <a
            className="font-mono underline decoration-gray-300 underline-offset-2 hover:text-blue-700 dark:decoration-slate-600 dark:hover:text-blue-300"
            href={links.commitUrl}
            rel="noreferrer"
            target="_blank"
          >
            <HighlightedText query={searchText} text={revision} />
          </a>
        ) : (
          <span className="font-mono">
            <HighlightedText query={searchText} text={revision} />
          </span>
        )}
      </p>
      <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">
        <span data-deployment-duration={duration}>소요 {duration}</span>
        {" · "}
        {formatProbe(entry)} · {formatDateTime(entry.completed_at, timezone)}
      </p>
      {entry.failure_reason ? (
        <p
          className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-100"
          data-deployment-failure-detail
        >
          {entry.failure_stage ? `${MANAGER_DEPLOYMENT_FAILURE_STAGE_LABELS[entry.failure_stage]} · ` : ""}
          <HighlightedText query={searchText} text={entry.failure_reason} />
        </p>
      ) : null}
      <DeploymentAlertRun entry={entry} timezone={timezone} />
    </li>
  );
}

function HighlightedText({ query, text }: { query: string; text: string }) {
  const normalizedQuery = query.trim().toLowerCase();
  const matchStart = normalizedQuery ? text.toLowerCase().indexOf(normalizedQuery) : -1;
  if (matchStart < 0) return text;

  const matchEnd = matchStart + normalizedQuery.length;
  return (
    <>
      {text.slice(0, matchStart)}
      <mark
        className="rounded-sm bg-yellow-200 px-0.5 text-inherit dark:bg-yellow-400/30"
        data-history-search-highlight
      >
        {text.slice(matchStart, matchEnd)}
      </mark>
      {text.slice(matchEnd)}
    </>
  );
}

function DeploymentAlertRun({
  entry,
  timezone,
}: {
  entry: ManagerDeploymentHistoryEntry;
  timezone?: string;
}) {
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
      ) : requestFailed ? null : (
        " · 실행 링크 미확인"
      )}
      {entry.alert_run_checked_at
        ? ` · 확인 ${formatDateTime(entry.alert_run_checked_at, timezone)}`
        : ""}
      {entry.alert_run_error ? ` · ${entry.alert_run_error}` : ""}
    </p>
  );
}

function formatProbe(entry: ManagerDeploymentHistoryEntry): string {
  if (entry.probe_total === 0) return "공개 probe 전 종료";
  if (entry.probe_failures > 0) {
    return `probe ${entry.probe_total}건 중 ${entry.probe_failures}건 실패`;
  }
  return `probe ${entry.probe_total}건 모두 HTTP 200`;
}
