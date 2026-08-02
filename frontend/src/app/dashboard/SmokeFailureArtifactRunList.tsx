import type { SmokeMonitoringRecentRun } from "@/features/settings/api/settingsApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import {
  getSmokeArtifactExpiryState,
  getSmokeArtifactRemainingLabel,
  type SmokeArtifactExpiryState,
} from "@/shared/lib/smokeArtifactExpiry";

const STATUS_LABELS = {
  failure: "실패",
  skipped: "건너뜀",
  success: "성공",
  cancelled: "취소됨",
} as const;

const ARTIFACT_EXPIRY_LABELS: Record<SmokeArtifactExpiryState, string> = {
  active: "만료",
  expiring_soon: "만료 임박",
  expired: "만료됨",
};

const ARTIFACT_EXPIRY_STYLES: Record<SmokeArtifactExpiryState, string> = {
  active: "text-slate-500 dark:text-slate-400",
  expiring_soon: "bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  expired: "bg-rose-100 px-1.5 py-0.5 font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-200",
};

interface SmokeFailureArtifactRunListProps {
  periodReferenceTime: number;
  runs: SmokeMonitoringRecentRun[];
  timezone?: string;
}

export function SmokeFailureArtifactRunList({
  periodReferenceTime,
  runs,
  timezone,
}: SmokeFailureArtifactRunListProps) {
  return (
    <>
      {runs.map((run, index) => {
        const runLabel = run.run_number ? `#${run.run_number}` : `${index + 1}번`;
        const expiryState = getSmokeArtifactExpiryState(
          run.artifact_expires_at,
          periodReferenceTime,
        );
        const remainingLabel = getSmokeArtifactRemainingLabel(
          run.artifact_expires_at,
          periodReferenceTime,
        );
        return (
          <span
            key={run.run_url}
            className="inline-flex items-center gap-1"
            data-artifact-expires-at={run.artifact_expires_at || undefined}
            data-artifact-state={expiryState || (run.artifact_url ? "available" : "none")}
            data-testid="smoke-failure-run"
          >
            <a
              className="font-semibold text-rose-700 underline underline-offset-2 dark:text-rose-300"
              href={run.run_url}
              target="_blank"
              rel="noreferrer"
              title={getSmokeRunTooltip(run, timezone)}
            >
              {runLabel}
            </a>
            {run.artifact_url && expiryState === "expired" ? (
              <span
                aria-disabled="true"
                className="cursor-not-allowed font-semibold text-slate-500 line-through dark:text-slate-400"
                data-testid="smoke-failure-artifact-expired"
                title="보관 기간이 끝나 실패 화면을 다운로드할 수 없습니다"
              >
                화면 만료
              </span>
            ) : run.artifact_url ? (
              <a
                aria-label={`${runLabel} 실패 화면 Artifact`}
                className="font-semibold text-cyan-700 underline underline-offset-2 dark:text-cyan-300"
                data-testid="smoke-failure-artifact-link"
                href={run.artifact_url}
                target="_blank"
                rel="noreferrer"
                title="GitHub 로그인 후 실패 화면 ZIP 다운로드"
              >
                화면
              </a>
            ) : null}
            {run.artifact_url && run.artifact_expires_at && expiryState ? (
              <span
                className={`rounded ${ARTIFACT_EXPIRY_STYLES[expiryState]}`}
                data-expiry-state={expiryState}
                data-remaining-label={remainingLabel || undefined}
                data-testid="smoke-artifact-expiry"
                title={`Artifact 만료 시각: ${formatDateTime(run.artifact_expires_at, timezone)}`}
              >
                {ARTIFACT_EXPIRY_LABELS[expiryState]}
                {remainingLabel ? ` · ${remainingLabel}` : ""}
                {` · ${formatDateTime(run.artifact_expires_at, timezone)}`}
              </span>
            ) : null}
          </span>
        );
      })}
    </>
  );
}

export function getSmokeRunTooltip(run: SmokeMonitoringRecentRun, timezone?: string) {
  return [
    run.run_number ? `#${run.run_number}` : "실행",
    STATUS_LABELS[run.status],
    formatDateTime(run.completed_at, timezone),
    run.summary,
  ].filter(Boolean).join(" · ");
}
