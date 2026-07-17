import { Copy, GitCompareArrows } from "lucide-react";

import type { ManagerDeploymentHistoryEntry } from "@/features/deployment/api/deploymentApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

import {
  formatManagerDeploymentDurationMs,
  getManagerDeploymentDurationMs,
  getManagerDeploymentExcessDurationMs,
  MANAGER_DEPLOYMENT_FAILURE_STAGE_LABELS,
  MANAGER_DEPLOYMENT_STATUS_DISPLAY,
} from "./managerDeploymentHistoryDisplay";
import { ManagerDeploymentHistoryJsonDetails } from "./ManagerDeploymentHistoryJsonDetails";
import { ManagerDeploymentStageDurations } from "./ManagerDeploymentStageDurations";
import {
  buildManagerDeploymentLinks,
  getManagerDeploymentHistoryAnchor,
} from "./managerDeploymentLinks";
import type { ManagerDeploymentHistoryRecordSource } from "./managerDeploymentHistoryQuery";
import {
  getExternalWatchdogRunLabel,
  isExternalWatchdogRunFailure,
} from "./managerWatchdogStatus";

interface ManagerDeploymentHistoryItemProps {
  bottleneckThresholdMs: number;
  entry: ManagerDeploymentHistoryEntry;
  entrySource?: ManagerDeploymentHistoryRecordSource;
  onCopy: (label: string, value: string) => void;
  previousVersion?: string;
  searchText: string;
  source?: string | null;
  thresholdDurationMs: number | null;
  thresholdLabel: "P95" | "평균";
  timezone?: string;
}

export function ManagerDeploymentHistoryItem({
  bottleneckThresholdMs,
  entry,
  entrySource,
  onCopy,
  previousVersion,
  searchText,
  source,
  thresholdDurationMs,
  thresholdLabel,
  timezone,
}: ManagerDeploymentHistoryItemProps) {
  const status = MANAGER_DEPLOYMENT_STATUS_DISPLAY[entry.status];
  const durationMs = getManagerDeploymentDurationMs(entry.started_at, entry.completed_at);
  const duration = durationMs === null
    ? "확인 불가"
    : formatManagerDeploymentDurationMs(durationMs);
  const excessDurationMs = getManagerDeploymentExcessDurationMs(durationMs, thresholdDurationMs);
  const isSlowerThanThreshold = excessDurationMs !== null;
  const links = buildManagerDeploymentLinks({
    latestVersion: entry.version,
    previousVersion,
    revision: entry.revision,
    source,
  });
  const revision = entry.revision.slice(0, 12);

  return (
    <li
      className={`scroll-mt-4 rounded-lg border px-3 py-2.5 target:ring-2 target:ring-blue-200 dark:target:ring-blue-500/30 ${isSlowerThanThreshold
        ? "border-orange-300 bg-orange-50/70 dark:border-orange-500/50 dark:bg-orange-950/20"
        : "border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900"
      }`}
      data-deployment-failure-stage={entry.failure_stage ?? (entry.status === "success" ? undefined : "unknown")}
      data-deployment-delay-ms={excessDurationMs ?? undefined}
      data-deployment-slow={isSlowerThanThreshold ? "true" : "false"}
      data-deployment-status={entry.status}
      id={getManagerDeploymentHistoryAnchor(entry.revision, entry.completed_at)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>
          {status.label}
        </span>
        {entrySource ? (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              entrySource === "current"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200"
                : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
            }`}
            data-deployment-source={entrySource}
          >
            {entrySource === "current" ? "현재" : "보관"}
          </span>
        ) : null}
        {isSlowerThanThreshold ? (
          <span
            className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-800 dark:bg-orange-500/20 dark:text-orange-100"
            data-deployment-slow-badge
          >
            {thresholdLabel}보다 +{formatManagerDeploymentDurationMs(excessDurationMs)}
          </span>
        ) : null}
        <span
          className="text-xs font-semibold text-gray-800 dark:text-slate-200"
          data-deployment-slot-summary
        >
          전환 {entry.from_slot} → {entry.to_slot} · 최종 활성 {entry.active_slot}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-gray-600 dark:text-slate-300">
        <span>
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
        </span>
        <CopyValueButton
          kind="revision"
          label="커밋 SHA"
          onCopy={onCopy}
          value={entry.revision}
        />
        {links.compareUrl ? (
          <a
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-600 hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-200"
            data-deployment-compare
            href={links.compareUrl}
            rel="noreferrer"
            target="_blank"
          >
            <GitCompareArrows aria-hidden="true" className="h-3 w-3" />
            이전 버전 비교
          </a>
        ) : null}
      </div>
      <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">
        <span data-deployment-duration={duration}>소요 {duration}</span>
        {" · "}
        {formatProbe(entry)} · {formatDateTime(entry.completed_at, timezone)}
      </p>
      <ManagerDeploymentStageDurations
        alertThresholdMs={bottleneckThresholdMs}
        durations={entry.stage_durations_ms}
      />
      {entry.failure_reason ? (
        <div
          className="mt-2 flex items-start gap-2 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-100"
          data-deployment-failure-detail
        >
          <p className="min-w-0 flex-1 break-words">
            {entry.failure_stage ? `${MANAGER_DEPLOYMENT_FAILURE_STAGE_LABELS[entry.failure_stage]} · ` : ""}
            <HighlightedText query={searchText} text={entry.failure_reason} />
          </p>
          <CopyValueButton
            kind="failure_reason"
            label="실패 원인"
            onCopy={onCopy}
            value={entry.failure_reason}
          />
        </div>
      ) : null}
      <DeploymentAlertRun entry={entry} timezone={timezone} />
      <ManagerDeploymentHistoryJsonDetails entry={entry} onCopy={onCopy} />
    </li>
  );
}

function CopyValueButton({
  kind,
  label,
  onCopy,
  value,
}: {
  kind: "failure_reason" | "revision";
  label: string;
  onCopy: (label: string, value: string) => void;
  value: string;
}) {
  return (
    <button
      aria-label={`${label} 복사`}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-current/20 bg-white/70 px-2 py-1 text-[10px] font-semibold hover:bg-white dark:bg-slate-950/60 dark:hover:bg-slate-950"
      data-deployment-copy={kind}
      onClick={() => onCopy(label, value)}
      type="button"
    >
      <Copy aria-hidden="true" className="h-3 w-3" />
      {label === "커밋 SHA" ? "SHA 복사" : "원인 복사"}
    </button>
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
