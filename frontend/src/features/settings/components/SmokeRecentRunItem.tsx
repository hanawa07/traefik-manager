import type { SmokeMonitoringRecentRun } from "@/features/settings/api/settingsApi";
import { githubCommitUrl } from "@/features/settings/lib/smokeGithubUrls";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

import { SmokeArtifactExpiryLabel } from "./SmokeArtifactExpiryLabel";
import { SmokeArtifactLink } from "./SmokeArtifactLink";
import { SmokeFailureMetadataPreview } from "./SmokeFailureMetadataPreview";

const STATUS_LABELS = {
  success: "성공",
  failure: "실패",
  skipped: "건너뜀",
  cancelled: "취소됨",
} as const;

const STATUS_STYLES = {
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  failure: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  skipped: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  cancelled: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
} as const;

const CANCELLATION_REASON_LABELS = {
  timeout: "시간 초과",
  superseded: "새 실행으로 대체 추정",
  manual_or_unknown: "수동 또는 원인 미확인",
} as const;

interface SmokeRecentRunItemProps {
  referenceTime: number;
  run: SmokeMonitoringRecentRun;
  timezone?: string;
}

export function SmokeRecentRunItem({
  referenceTime,
  run,
  timezone,
}: SmokeRecentRunItemProps) {
  return (
    <li
      className="rounded-md border border-gray-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900"
      data-cancellation-reason={run.cancellation_reason || undefined}
      data-run-status={run.status}
      data-testid="smoke-recent-run-item"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_STYLES[run.status]}`}>
          {STATUS_LABELS[run.status]}
        </span>
        <a
          className="font-medium text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-300"
          href={run.run_url}
          target="_blank"
          rel="noreferrer"
        >
          {run.run_number ? `#${run.run_number}` : "실행 보기"}
        </a>
        {run.artifact_url ? (
          <SmokeArtifactLink
            artifactUrl={run.artifact_url}
            expiresAt={run.artifact_expires_at}
            label="실패 화면"
            expiredLabel="화면 만료"
            testId="smoke-recent-run-artifact-link"
            expiredTestId="smoke-recent-run-artifact-expired"
            referenceTime={referenceTime}
          />
        ) : null}
        {run.artifact_url && run.artifact_expires_at ? (
          <SmokeArtifactExpiryLabel
            expiresAt={run.artifact_expires_at}
            referenceTime={referenceTime}
            timezone={timezone}
          />
        ) : null}
        <span className="text-gray-500 dark:text-slate-400">
          {formatDateTime(run.completed_at, timezone)}
        </span>
        {run.status === "cancelled" ? (
          <span
            className="font-medium text-amber-700 dark:text-amber-300"
            data-testid="smoke-cancellation-reason"
          >
            취소 원인: {CANCELLATION_REASON_LABELS[run.cancellation_reason || "manual_or_unknown"]}
          </span>
        ) : null}
        {run.commit_sha ? (
          <a
            aria-label={`커밋 ${run.commit_sha} 보기`}
            className="text-gray-500 underline-offset-2 hover:underline dark:text-slate-400"
            data-testid="smoke-recent-run-commit-link"
            href={githubCommitUrl(run.run_url, run.commit_sha)}
            rel="noreferrer"
            target="_blank"
          >
            <code>{run.commit_sha}</code>
          </a>
        ) : null}
      </div>
      {run.summary ? (
        <p className="mt-2 text-gray-600 dark:text-slate-300">{run.summary}</p>
      ) : null}
      {run.notification_suppressed ? (
        <p className="mt-2 font-medium text-amber-700 dark:text-amber-300">
          중복 Telegram 알림 억제
        </p>
      ) : null}
      {run.failure_metadata ? (
        <SmokeFailureMetadataPreview metadata={run.failure_metadata} timezone={timezone} />
      ) : null}
    </li>
  );
}
