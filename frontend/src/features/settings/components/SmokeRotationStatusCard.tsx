import { MonitorCheck, Send } from "lucide-react";

import type {
  SmokeMonitoringSettingsInput,
  SmokeRotationState,
  SmokeRotationStatus,
  SettingsTestHistoryItem,
} from "@/features/settings/api/settingsApi";
import {
  SettingsCardHeader,
  SettingsSummary,
  SettingsSummaryRow,
} from "@/features/settings/components/SettingsCardPrimitives";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import { githubCommitUrl } from "@/features/settings/lib/smokeGithubUrls";
import { useGithubApiRefreshBlocked } from "@/features/settings/lib/smokeGithubRateLimit";
import type { TrackedManualSmokeRun } from "@/features/settings/lib/smokeManualRunTracking";
import { SmokeArtifactExpiryLabel } from "./SmokeArtifactExpiryLabel";
import { SmokeArtifactLink } from "./SmokeArtifactLink";
import { SmokeFailureMetadataPreview } from "./SmokeFailureMetadataPreview";
import { SmokeGithubApiDiagnostics } from "./SmokeGithubApiDiagnostics";
import { SmokeManualRunResult } from "./SmokeManualRunResult";
import { SmokeMonitoringSettingsEditForm } from "./SmokeMonitoringSettingsEditForm";
import { SmokeRecentRunHistory } from "./SmokeRecentRunHistory";
import { SmokeStaleAlertHistory } from "./SmokeStaleAlertHistory";

const STATUS_LABELS: Record<SmokeRotationState, string> = {
  never: "실행 기록 없음",
  running: "진행 중",
  success: "정상",
  failure: "실패",
};

const STATUS_STYLES: Record<SmokeRotationState, string> = {
  never: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  running: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  failure: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

interface SmokeRotationStatusCardProps {
  canManage: boolean;
  isLoading: boolean;
  isError: boolean;
  isEditing: boolean;
  status?: SmokeRotationStatus;
  staleAlertHistory?: SettingsTestHistoryItem;
  timezone?: string;
  formValue: SmokeMonitoringSettingsInput;
  errorMessage: string;
  isSaving: boolean;
  isRefreshingHistory: boolean;
  isTrackingManualRun: boolean;
  lastManualRun: TrackedManualSmokeRun | null;
  isTestingStaleAlert: boolean;
  isTestingGithubRateLimitAlert: boolean;
  onEdit: () => void;
  onSave: () => void;
  onRefreshHistory: () => void;
  onManualRunOpen: () => void;
  onClearManualRun: () => void;
  onTestStaleAlert: () => void;
  onTestGithubRateLimitAlert: () => void;
  onCancel: () => void;
  onFormChange: (value: SmokeMonitoringSettingsInput) => void;
}

export function SmokeRotationStatusCard({
  canManage,
  isLoading,
  isError,
  isEditing,
  status,
  staleAlertHistory,
  timezone,
  formValue,
  errorMessage,
  isSaving,
  isRefreshingHistory,
  isTrackingManualRun,
  lastManualRun,
  isTestingStaleAlert,
  isTestingGithubRateLimitAlert,
  onEdit,
  onSave,
  onRefreshHistory,
  onManualRunOpen,
  onClearManualRun,
  onTestStaleAlert,
  onTestGithubRateLimitAlert,
  onCancel,
  onFormChange,
}: SmokeRotationStatusCardProps) {
  const isStaleSuccess = status?.status === "success" && status.is_stale;
  const recentLogLines = status?.recent_log_lines ?? [];
  const monitoringEnabled = status?.monitoring_enabled ?? true;
  const monitoringFrequency = status?.monitoring_frequency ?? "daily";
  const scheduleTime = status?.monitoring_schedule_time ?? "03:17";
  const scheduleTimezone = status?.monitoring_schedule_timezone ?? "Asia/Seoul";
  const recentRuns = status?.monitoring_recent_runs ?? [];
  const latestFailure =
    status?.monitoring_latest_failure ?? recentRuns.find((run) => run.status === "failure");
  const artifactReferenceTime = Date.parse(status?.monitoring_history_checked_at || "");
  const suppressedRuns = recentRuns.filter((run) => run.notification_suppressed);
  const latestSuppressed = suppressedRuns[0];
  const secretRetryCount = status?.detail?.match(/GitHub secret 갱신 실패: .+ \(시도 (\d+\/\d+)\)$/)?.[1];
  const isGithubRefreshBlocked = useGithubApiRefreshBlocked(
    status?.monitoring_github_rate_limit_remaining,
    status?.monitoring_github_rate_limit_reset_at,
    status?.monitoring_github_secondary_limit_retry_at,
    status?.monitoring_github_refresh_reserve,
  );

  return (
    <div className="card order-6 p-6" data-testid="smoke-rotation-status-card">
      <SettingsCardHeader
        icon={<MonitorCheck className="h-5 w-5 text-cyan-600" />}
        title="운영 로그인·화면 점검"
        description="정상 사용자 로그인과 주요 화면 로딩을 확인하는 운영 점검입니다. 공격 탐지나 취약점 검사는 로그인 보안 방어와 별개입니다."
        canEdit={canManage && !isEditing && !isLoading}
        onEdit={onEdit}
      />

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-slate-800" />
      ) : isError || !status ? (
        <p className="text-sm text-rose-600 dark:text-rose-300">운영 점검 상태를 불러오지 못했습니다.</p>
      ) : isEditing ? (
        <SmokeMonitoringSettingsEditForm
          formValue={formValue}
          scheduleTime={scheduleTime}
          scheduleTimezone={scheduleTimezone}
          errorMessage={errorMessage}
          isSaving={isSaving}
          onSave={onSave}
          onCancel={onCancel}
          onFormChange={onFormChange}
        />
      ) : (
        <SettingsSummary>
          <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-900 dark:border-cyan-900 dark:bg-cyan-950/50 dark:text-cyan-200">
            전용 viewer로 일반 화면을, 전용 admin으로 관리자 안전 흐름을 확인합니다. 비밀번호 공격이나 침입 징후는 별도 로그인 보안 방어 설정에서 처리합니다.
            <span className="mt-1 block" data-testid="smoke-test-run-exclusion-note">
              [테스트] 실행은 최근 실행·실패율 집계에서 제외합니다.
            </span>
          </div>
          <SettingsSummaryRow
            label="예약 자동 점검"
            value={monitoringEnabled ? "사용" : "중지"}
          />
          <SettingsSummaryRow
            label="점검 주기"
            value={monitoringFrequency === "daily" ? "매일" : "매주 일요일"}
          />
          <SettingsSummaryRow label="점검 시각" value={`${scheduleTime} (${scheduleTimezone})`} />
          <SettingsSummaryRow
            label="실패율 경고 기준"
            value={`최근 ${status.monitoring_failure_rate_window_days}일 ${status.monitoring_failure_rate_min_runs}회 이상 · ${status.monitoring_failure_rate_threshold_percent}% 이상`}
          />
          <SettingsSummaryRow
            label="GitHub API 반복 제한 알림"
            value={
              status.monitoring_github_rate_limit_alert_enabled
                ? `${status.monitoring_github_rate_limit_alert_window_hours}시간 · 기본 ${status.monitoring_github_primary_limit_alert_threshold}회 · 보조 ${status.monitoring_github_secondary_limit_alert_threshold}회`
                : "사용 안 함"
            }
          />
          {canManage ? (
            <SettingsSummaryRow
              label="GitHub API 제한 알림 dry-run"
              value={
                <button
                  type="button"
                  className="btn-secondary inline-flex items-center gap-1.5 py-1.5 text-xs"
                  data-testid="smoke-github-rate-limit-alert-test"
                  onClick={onTestGithubRateLimitAlert}
                  disabled={isTestingGithubRateLimitAlert}
                >
                  <Send className="h-3.5 w-3.5" />
                  {isTestingGithubRateLimitAlert ? "전송 중" : "운영 경로 테스트"}
                </button>
              }
            />
          ) : null}
          <SettingsSummaryRow
            label="최근 원격 점검 성공"
            value={
              status.monitoring_last_run_url ? (
                <a
                  className="text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-300"
                  href={status.monitoring_last_run_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {formatDateTime(status.monitoring_last_success_at, timezone)}
                </a>
              ) : (
                "기록 없음"
              )
            }
          />
          <SettingsSummaryRow
            label="관리자 전용 점검 최근 성공"
            value={
              status.monitoring_admin_last_run_url ? (
                <a
                  className="text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-300"
                  data-testid="smoke-admin-last-success"
                  href={status.monitoring_admin_last_run_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {formatDateTime(status.monitoring_admin_last_success_at, timezone)}
                </a>
              ) : (
                "기록 없음"
              )
            }
          />
          <SettingsSummaryRow
            label="관리자 점검 지연 판정"
            value={`최근 성공 ${status.monitoring_admin_stale_after_days}일 초과 시 경고`}
          />
          {canManage ? (
            <SettingsSummaryRow
              label="관리자 지연 알림 dry-run"
              value={
                <button
                  type="button"
                  className="btn-secondary inline-flex items-center gap-1.5 py-1.5 text-xs"
                  onClick={onTestStaleAlert}
                  disabled={isTestingStaleAlert}
                >
                  <Send className="h-3.5 w-3.5" />
                  {isTestingStaleAlert ? "전송 중" : "Telegram 테스트 전송"}
                </button>
              }
            />
          ) : null}
          <SmokeStaleAlertHistory history={staleAlertHistory} timezone={timezone} />
          {status.monitoring_admin_is_stale ? (
            <div
              className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200"
              data-testid="smoke-admin-stale-warning"
            >
              관리자 전용 점검이 {status.monitoring_admin_stale_after_days}일 넘게 성공하지
              않았습니다. GitHub Actions와 admin secret을 확인하세요.
            </div>
          ) : null}
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
          <SettingsSummaryRow
            label="반복 실패 알림 억제"
            value={
              status.monitoring_history_error && recentRuns.length === 0
                ? "확인 불가"
                : suppressedRuns.length > 0 && latestSuppressed
                  ? `최근 ${recentRuns.length}회 중 ${suppressedRuns.length}회 · 마지막 ${formatDateTime(latestSuppressed.completed_at, timezone)}`
                  : recentRuns.length > 0
                    ? `최근 ${recentRuns.length}회 중 없음`
                    : "최근 실행 없음"
            }
          />
          <SettingsSummaryRow
            label="수동 점검"
            value={
              <span className="flex max-w-md flex-col items-end gap-1 text-right">
                <a
                  className="text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-300"
                  href={status.monitoring_workflow_url}
                  onClick={onManualRunOpen}
                  target="_blank"
                  rel="noreferrer"
                >
                  GitHub Actions에서 실행
                </a>
                <span
                  className="text-[11px] font-normal text-slate-500 dark:text-slate-400"
                  data-testid="smoke-manual-suppress-notice"
                >
                  실행 창에서 &quot;수동 실행 실패 시 Telegram 알림 생략&quot;을 체크할 수 있습니다.
                </span>
                <span
                  aria-live="polite"
                  className="text-[11px] font-normal text-slate-500 dark:text-slate-400"
                  data-testid="smoke-manual-tracking-status"
                >
                  {canManage && isTrackingManualRun
                    ? "새 실행 결과 확인 중..."
                    : canManage && isGithubRefreshBlocked
                      ? "GitHub API 초기화 후 새 실행 결과를 자동 확인할 수 있습니다."
                    : `${canManage ? "" : "관리자 계정으로 "}링크를 열면 새 실행 결과를 6분간 자동 확인합니다.`}
                </span>
              </span>
            }
          />
          {lastManualRun ? (
            <SettingsSummaryRow
              label="마지막 수동 점검 결과"
              value={
                <SmokeManualRunResult
                  onClear={onClearManualRun}
                  run={lastManualRun}
                  timezone={timezone}
                />
              }
            />
          ) : null}
          {status.monitoring_history_error ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
              {status.monitoring_history_error}. 저장된 최근 성공 기록은 그대로 표시됩니다.
            </div>
          ) : null}
          <SmokeGithubApiDiagnostics
            canManage={canManage}
            isRefreshBlocked={isGithubRefreshBlocked}
            isRefreshing={isRefreshingHistory}
            onRefresh={onRefreshHistory}
            status={status}
            timezone={timezone}
          />
          <SmokeRecentRunHistory
            status={status}
            timezone={timezone}
          />

          <div className="my-3 border-t border-gray-200 dark:border-slate-700" />
          <SettingsSummaryRow
            label="점검 계정 비밀번호"
            value={
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${isStaleSuccess ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : STATUS_STYLES[status.status]}`}>
                {isStaleSuccess ? "회전 점검 필요" : STATUS_LABELS[status.status]}
              </span>
            }
          />
          <SettingsSummaryRow label="최근 회전 시도" value={formatDateTime(status.last_attempt_at, timezone)} />
          <SettingsSummaryRow label="최근 회전 성공" value={formatDateTime(status.last_success_at, timezone)} />
          <SettingsSummaryRow label="계정 회전 주기" value="매월 1일 04:17" />
          <SettingsSummaryRow
            label="회전 실패 단계"
            value={
              status.status === "failure" ? (
                <code
                  className="break-all text-rose-700 dark:text-rose-300"
                  data-testid="smoke-rotation-failure-step"
                >
                  {status.detail || "알 수 없는 단계"}
                </code>
              ) : (
                "없음"
              )
            }
          />
          <SettingsSummaryRow
            label="Secret 재시도 횟수"
            value={status.status === "failure" ? secretRetryCount || "해당 없음" : "없음"}
          />
          {status.status === "running" && status.detail ? (
            <SettingsSummaryRow label="회전 진행 상태" value={status.detail} />
          ) : null}
          {status.is_stale ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
              마지막 성공 후 {status.stale_after_days}일이 지났습니다. cron 실행 로그와 GitHub secret 동기화를 확인하세요.
            </div>
          ) : null}
          <details className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-950">
            <summary className="cursor-pointer text-xs font-semibold text-gray-700 dark:text-slate-200">
              최근 계정 회전 cron 로그 · {formatDateTime(status.log_updated_at, timezone)}
            </summary>
            {recentLogLines.length ? (
              <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-all text-[11px] leading-5 text-gray-600 dark:text-slate-300">
                {recentLogLines.join("\n")}
              </pre>
            ) : (
              <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">표시할 cron 로그가 없습니다.</p>
            )}
          </details>
        </SettingsSummary>
      )}
    </div>
  );
}
