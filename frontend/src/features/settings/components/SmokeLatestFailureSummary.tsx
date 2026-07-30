import type { SmokeRotationStatus } from "@/features/settings/api/settingsApi";
import { SettingsSummaryRow } from "@/features/settings/components/SettingsCardPrimitives";
import { githubCommitUrl } from "@/features/settings/lib/smokeGithubUrls";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

import { SmokeArtifactExpiryLabel } from "./SmokeArtifactExpiryLabel";
import { SmokeArtifactLink } from "./SmokeArtifactLink";
import { SmokeFailureMetadataPreview } from "./SmokeFailureMetadataPreview";

interface SmokeLatestFailureSummaryProps {
  canManage: boolean;
  status: SmokeRotationStatus;
  timezone?: string;
}

export function SmokeLatestFailureSummary({
  canManage,
  status,
  timezone,
}: SmokeLatestFailureSummaryProps) {
  const latestFailure =
    status.monitoring_latest_failure ??
    (status.monitoring_recent_runs ?? []).find((run) => run.status === "failure");
  const artifactReferenceTime = Date.parse(status.monitoring_history_checked_at || "");

  return (
    <>
      <SettingsSummaryRow
        label="최근 원격 점검 실패"
        value={
          latestFailure ? (
            <a
              className="text-rose-700 underline-offset-2 hover:underline dark:text-rose-300"
              href={latestFailure.run_url}
              target="_blank"
              rel="noreferrer"
            >
              {formatDateTime(latestFailure.completed_at, timezone)}
            </a>
          ) : status.monitoring_history_error ? (
            "확인 불가"
          ) : (
            "기록 없음"
          )
        }
      />
      {latestFailure?.summary ? (
        <SettingsSummaryRow label="최근 실패 요약" value={latestFailure.summary} />
      ) : null}
      {latestFailure?.commit_sha ? (
        <SettingsSummaryRow
          label="최근 실패 커밋"
          value={
            <a
              className="text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-300"
              data-testid="smoke-latest-failure-commit-link"
              href={githubCommitUrl(latestFailure.run_url, latestFailure.commit_sha)}
              rel="noreferrer"
              target="_blank"
            >
              <code>{latestFailure.commit_sha}</code>
            </a>
          }
        />
      ) : null}
      {latestFailure?.failure_metadata ? (
        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
          <span className="text-gray-500 dark:text-slate-400">최근 실패 정보</span>
          <div className="min-w-0 sm:w-96">
            <SmokeFailureMetadataPreview
              metadata={latestFailure.failure_metadata}
              testId="smoke-latest-failure-metadata-preview"
              timezone={timezone}
            />
          </div>
        </div>
      ) : null}
      {latestFailure?.artifact_url ? (
        <SettingsSummaryRow
          label="최근 실패 화면"
          value={
            <SmokeArtifactLink
              artifactUrl={latestFailure.artifact_url}
              expiresAt={latestFailure.artifact_expires_at}
              label="artifact 받기"
              expiredLabel="artifact 만료"
              expiredTestId="smoke-latest-failure-artifact-expired"
              referenceTime={artifactReferenceTime}
            />
          }
        />
      ) : null}
      <SettingsSummaryRow
        label="Artifact 만료"
        value={
          latestFailure?.artifact_expires_at ? (
            <SmokeArtifactExpiryLabel
              expiresAt={latestFailure.artifact_expires_at}
              referenceTime={artifactReferenceTime}
              timezone={timezone}
            />
          ) : canManage ? (
            "활성 artifact 없음"
          ) : (
            "관리자만 확인 가능"
          )
        }
      />
    </>
  );
}
