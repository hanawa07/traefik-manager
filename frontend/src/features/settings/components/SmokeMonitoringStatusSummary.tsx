import type {
  SmokeRotationStatus,
  SettingsTestHistoryItem,
} from "@/features/settings/api/settingsApi";
import { SettingsSummaryRow } from "@/features/settings/components/SettingsCardPrimitives";
import { useGithubApiRefreshBlocked } from "@/features/settings/lib/smokeGithubRateLimit";
import type { TrackedManualSmokeRun } from "@/features/settings/lib/smokeManualRunTracking";
import { SmokeGithubApiDiagnostics } from "./SmokeGithubApiDiagnostics";
import { SmokeManualRunResult } from "./SmokeManualRunResult";
import { SmokeMonitoringOverview } from "./SmokeMonitoringOverview";
import { SmokeRecentRunHistory } from "./SmokeRecentRunHistory";

interface SmokeMonitoringStatusSummaryProps {
  canManage: boolean;
  status: SmokeRotationStatus;
  staleAlertHistory?: SettingsTestHistoryItem;
  failureTypeIncreaseAlertHistory?: SettingsTestHistoryItem;
  githubRateLimitAlertHistory?: SettingsTestHistoryItem;
  githubPrimaryRateLimitDeliveryHistory?: SettingsTestHistoryItem;
  githubSecondaryRateLimitDeliveryHistory?: SettingsTestHistoryItem;
  githubPrimaryRateLimitLastTriggeredAt?: string | null;
  githubSecondaryRateLimitLastTriggeredAt?: string | null;
  timezone?: string;
  isRefreshingHistory: boolean;
  isTrackingManualRun: boolean;
  lastManualRun: TrackedManualSmokeRun | null;
  isTestingStaleAlert: boolean;
  isTestingGithubRateLimitAlert: boolean;
  isTestingFailureTypeIncreaseAlert: boolean;
  onRefreshHistory: () => void;
  onManualRunOpen: () => void;
  onClearManualRun: () => void;
  onTestStaleAlert: () => void;
  onTestGithubRateLimitAlert: () => void;
  onTestFailureTypeIncreaseAlert: () => void;
}

export function SmokeMonitoringStatusSummary({
  canManage,
  status,
  staleAlertHistory,
  failureTypeIncreaseAlertHistory,
  githubRateLimitAlertHistory,
  githubPrimaryRateLimitDeliveryHistory,
  githubSecondaryRateLimitDeliveryHistory,
  githubPrimaryRateLimitLastTriggeredAt,
  githubSecondaryRateLimitLastTriggeredAt,
  timezone,
  isRefreshingHistory,
  isTrackingManualRun,
  lastManualRun,
  isTestingStaleAlert,
  isTestingGithubRateLimitAlert,
  isTestingFailureTypeIncreaseAlert,
  onRefreshHistory,
  onManualRunOpen,
  onClearManualRun,
  onTestStaleAlert,
  onTestGithubRateLimitAlert,
  onTestFailureTypeIncreaseAlert,
}: SmokeMonitoringStatusSummaryProps) {
  const isGithubRefreshBlocked = useGithubApiRefreshBlocked(
    status.monitoring_github_rate_limit_remaining,
    status.monitoring_github_rate_limit_reset_at,
    status.monitoring_github_secondary_limit_retry_at,
    status.monitoring_github_refresh_reserve,
  );

  return (
    <>
      <SmokeMonitoringOverview
        canManage={canManage}
        isTestingGithubRateLimitAlert={isTestingGithubRateLimitAlert}
        isTestingFailureTypeIncreaseAlert={isTestingFailureTypeIncreaseAlert}
        isTestingStaleAlert={isTestingStaleAlert}
        onTestGithubRateLimitAlert={onTestGithubRateLimitAlert}
        onTestFailureTypeIncreaseAlert={onTestFailureTypeIncreaseAlert}
        onTestStaleAlert={onTestStaleAlert}
        staleAlertHistory={staleAlertHistory}
        failureTypeIncreaseAlertHistory={failureTypeIncreaseAlertHistory}
        status={status}
        timezone={timezone}
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
              실행 창에서 &quot;수동 실행 실패 시 Telegram 알림 생략&quot;을 체크할 수
              있습니다.
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
        alertHistory={githubRateLimitAlertHistory}
        primaryOperationalAlertHistory={githubPrimaryRateLimitDeliveryHistory}
        secondaryOperationalAlertHistory={githubSecondaryRateLimitDeliveryHistory}
        primaryLastTriggeredAt={githubPrimaryRateLimitLastTriggeredAt}
        secondaryLastTriggeredAt={githubSecondaryRateLimitLastTriggeredAt}
      />
      <SmokeRecentRunHistory canManage={canManage} status={status} timezone={timezone} />
    </>
  );
}
