import { Send } from "lucide-react";

import type {
  SmokeRotationStatus,
  SettingsTestHistoryItem,
} from "@/features/settings/api/settingsApi";
import { SettingsSummaryRow } from "@/features/settings/components/SettingsCardPrimitives";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

import { SmokeLatestFailureSummary } from "./SmokeLatestFailureSummary";
import { SmokeStaleAlertHistory } from "./SmokeStaleAlertHistory";

interface SmokeMonitoringOverviewProps {
  canManage: boolean;
  isTestingGithubRateLimitAlert: boolean;
  isTestingFailureTypeIncreaseAlert: boolean;
  isTestingStaleAlert: boolean;
  onTestGithubRateLimitAlert: () => void;
  onTestFailureTypeIncreaseAlert: () => void;
  onTestStaleAlert: () => void;
  staleAlertHistory?: SettingsTestHistoryItem;
  failureTypeIncreaseAlertHistory?: SettingsTestHistoryItem;
  status: SmokeRotationStatus;
  timezone?: string;
}

export function SmokeMonitoringOverview({
  canManage,
  isTestingGithubRateLimitAlert,
  isTestingFailureTypeIncreaseAlert,
  isTestingStaleAlert,
  onTestGithubRateLimitAlert,
  onTestFailureTypeIncreaseAlert,
  onTestStaleAlert,
  staleAlertHistory,
  failureTypeIncreaseAlertHistory,
  status,
  timezone,
}: SmokeMonitoringOverviewProps) {
  const monitoringEnabled = status.monitoring_enabled ?? true;
  const isLocalMode = status.monitoring_mode === "local";
  const monitoringFrequency = status.monitoring_frequency ?? "daily";
  const scheduleTime = status.monitoring_schedule_time ?? "03:17";
  const scheduleTimezone = status.monitoring_schedule_timezone ?? "Asia/Seoul";
  const recentRuns = status.monitoring_recent_runs ?? [];
  const suppressedRuns = recentRuns.filter((run) => run.notification_suppressed);
  const latestSuppressed = suppressedRuns[0];

  return (
    <>
      <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-900 dark:border-cyan-900 dark:bg-cyan-950/50 dark:text-cyan-200">
        {isLocalMode
          ? "Tailnet 호스트에서 전용 viewer와 admin으로 실제 로그인·주요 화면을 점검합니다. GitHub workflow는 코드와 알림 경로 self-test만 수행합니다."
          : "전용 viewer로 일반 화면을, 전용 admin으로 관리자 안전 흐름을 확인합니다. 비밀번호 공격이나 침입 징후는 별도 로그인 보안 방어 설정에서 처리합니다."}
        <span className="mt-1 block" data-testid="smoke-test-run-exclusion-note">
          {isLocalMode
            ? "아래 전체 통계는 GitHub workflow 결론 기준의 참고 이력입니다. 전환 전 원격 점검과 이후 도구 self-test가 섞일 수 있어 현재 운영 정상 여부는 로컬 점검 결과로 판단합니다."
            : "[테스트] 실행은 제외합니다. 전체 통계는 GitHub workflow 결론 기준이며, 내부 단계만 건너뛴 성공 workflow는 성공에 포함될 수 있습니다."}
        </span>
      </div>
      <SettingsSummaryRow
        label={isLocalMode ? "운영 점검 방식" : "예약 자동 점검"}
        value={isLocalMode ? "Tailnet 호스트 로컬 점검" : monitoringEnabled ? "사용" : "중지"}
      />
      <SettingsSummaryRow
        label="점검 주기"
        value={
          isLocalMode
            ? "매월 1일 계정 회전 후"
            : monitoringFrequency === "daily"
              ? "매일"
              : "매주 일요일"
        }
      />
      <SettingsSummaryRow
        label="점검 시각"
        value={isLocalMode ? "04:17 (호스트 시간)" : `${scheduleTime} (${scheduleTimezone})`}
      />
      <SettingsSummaryRow
        label="실패율 경고 기준"
        value={`최근 ${status.monitoring_failure_rate_window_days}일 ${status.monitoring_failure_rate_min_runs}회 이상 · ${status.monitoring_failure_rate_threshold_percent}% 이상`}
      />
      <SettingsSummaryRow
        label="실패 유형 증가 운영 알림"
        value={status.monitoring_failure_type_alert_enabled ? "사용" : "사용 안 함"}
      />
      {canManage ? (
        <SettingsSummaryRow
          label="실패 유형 증가 알림 dry-run"
          value={
            <button
              type="button"
              className="btn-secondary inline-flex items-center gap-1.5 py-1.5 text-xs"
              data-testid="smoke-failure-type-increase-alert-test"
              onClick={onTestFailureTypeIncreaseAlert}
              disabled={isTestingFailureTypeIncreaseAlert}
            >
              <Send className="h-3.5 w-3.5" />
              {isTestingFailureTypeIncreaseAlert ? "전송 중" : "운영 경로 테스트"}
            </button>
          }
        />
      ) : null}
      {canManage ? (
        <SmokeStaleAlertHistory
          history={failureTypeIncreaseAlertHistory}
          label="실패 유형 증가 최근 dry-run 결과"
          historyLabel="실패 유형 증가 dry-run 최근 이력"
          timezone={timezone}
        />
      ) : null}
      <SettingsSummaryRow
        label="실패 분류 정보 보관"
        value={
          canManage
            ? `${status.monitoring_failure_metadata_count}/${status.monitoring_failure_metadata_limit}건`
            : `최대 ${status.monitoring_failure_metadata_limit}건`
        }
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
        label={isLocalMode ? "최근 원격 점검 성공 (GitHub 참고 이력)" : "최근 원격 점검 성공"}
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
        label={isLocalMode ? "관리자 전용 점검 최근 성공 (GitHub 참고 이력)" : "관리자 전용 점검 최근 성공"}
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
        label={isLocalMode ? "관리자 점검 지연 판정 (로컬)" : "관리자 점검 지연 판정"}
        value={`최근 성공 ${isLocalMode ? status.stale_after_days : status.monitoring_admin_stale_after_days}일 초과 시 경고`}
      />
      {canManage && !isLocalMode ? (
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
      {!isLocalMode ? <SmokeStaleAlertHistory history={staleAlertHistory} timezone={timezone} /> : null}
      {status.monitoring_admin_is_stale ? (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200"
          data-testid="smoke-admin-stale-warning"
        >
          관리자 전용 점검이 {status.monitoring_admin_stale_after_days}일 넘게 성공하지
          않았습니다. GitHub Actions와 admin secret을 확인하세요.
        </div>
      ) : null}
      <SmokeLatestFailureSummary canManage={canManage} status={status} timezone={timezone} />
      <SettingsSummaryRow
        label={isLocalMode ? "GitHub 참고 이력 반복 알림 억제" : "반복 실패 알림 억제"}
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
    </>
  );
}
