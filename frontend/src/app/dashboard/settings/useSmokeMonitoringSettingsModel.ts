import { useEffect, useRef, useState } from "react";

import type { SmokeMonitoringSettingsInput } from "@/features/settings/api/settingsApi";
import {
  useRefreshSmokeMonitoringHistory,
  useSettingsTestHistory,
  useSmokeRotationStatus,
  useTestGithubApiRateLimitAlert,
  useTestSmokeAdminStaleAlert,
  useUpdateSmokeMonitoringSettings,
} from "@/features/settings/hooks/useSettings";
import {
  findNewSmokeRun,
  getTrackedManualSmokeRun,
  LAST_MANUAL_SMOKE_RUN_STORAGE_KEY,
  parseTrackedManualSmokeRun,
  type TrackedManualSmokeRun,
} from "@/features/settings/lib/smokeManualRunTracking";
import type { ToastNoticeValue } from "@/shared/components/ToastNotice";
import {
  isGithubApiRefreshBlocked,
  isGithubSecondaryRateLimitBlocked,
} from "@/features/settings/lib/smokeGithubRateLimit";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import { getSettingsModelErrorMessage } from "./settingsModelErrors";

const DEFAULT_FORM: SmokeMonitoringSettingsInput = {
  monitoring_enabled: true,
  monitoring_frequency: "daily",
  monitoring_failure_rate_threshold_percent: 30,
  monitoring_failure_rate_min_runs: 3,
  monitoring_failure_rate_window_days: 7,
  monitoring_github_rate_limit_alert_enabled: false,
  monitoring_github_primary_limit_alert_threshold: 3,
  monitoring_github_secondary_limit_alert_threshold: 3,
  monitoring_github_rate_limit_alert_window_hours: 24,
};
const MANUAL_RUN_POLL_INTERVAL_MS = 30_000;
const MANUAL_RUN_TRACKING_TIMEOUT_MS = 6 * 60_000;

export function useSmokeMonitoringSettingsModel(
  canManage: boolean,
  timezone: string | undefined,
  onToast: (notice: ToastNoticeValue) => void,
) {
  const query = useSmokeRotationStatus();
  const update = useUpdateSmokeMonitoringSettings();
  const refreshHistory = useRefreshSmokeMonitoringHistory();
  const testHistory = useSettingsTestHistory();
  const testStaleAlert = useTestSmokeAdminStaleAlert();
  const testGithubRateLimitAlert = useTestGithubApiRateLimitAlert();
  const [isEditing, setIsEditing] = useState(false);
  const [formValue, setFormValue] = useState(DEFAULT_FORM);
  const [errorMessage, setErrorMessage] = useState("");
  const [isTrackingManualRun, setIsTrackingManualRun] = useState(false);
  const [lastManualRun, setLastManualRun] = useState<TrackedManualSmokeRun | null>(null);
  const manualRunTimerRef = useRef<number | null>(null);
  const manualRunGenerationRef = useRef(0);
  const isGithubSecondaryBlocked = isGithubSecondaryRateLimitBlocked(
    query.data?.monitoring_github_secondary_limit_retry_at,
  );
  const githubRefreshRetryAt = isGithubSecondaryBlocked
    ? query.data?.monitoring_github_secondary_limit_retry_at
    : query.data?.monitoring_github_rate_limit_reset_at;

  useEffect(() => () => {
    manualRunGenerationRef.current += 1;
    if (manualRunTimerRef.current !== null) {
      window.clearTimeout(manualRunTimerRef.current);
    }
  }, []);

  useEffect(() => {
    try {
      setLastManualRun(
        parseTrackedManualSmokeRun(window.localStorage.getItem(LAST_MANUAL_SMOKE_RUN_STORAGE_KEY)),
      );
    } catch {
      setLastManualRun(null);
    }
  }, []);

  const handleEdit = () => {
    setFormValue({
      monitoring_enabled: query.data?.monitoring_enabled ?? true,
      monitoring_frequency: query.data?.monitoring_frequency ?? "daily",
      monitoring_failure_rate_threshold_percent:
        query.data?.monitoring_failure_rate_threshold_percent ?? 30,
      monitoring_failure_rate_min_runs: query.data?.monitoring_failure_rate_min_runs ?? 3,
      monitoring_failure_rate_window_days:
        query.data?.monitoring_failure_rate_window_days ?? 7,
      monitoring_github_rate_limit_alert_enabled:
        query.data?.monitoring_github_rate_limit_alert_enabled ?? false,
      monitoring_github_primary_limit_alert_threshold:
        query.data?.monitoring_github_primary_limit_alert_threshold ?? 3,
      monitoring_github_secondary_limit_alert_threshold:
        query.data?.monitoring_github_secondary_limit_alert_threshold ?? 3,
      monitoring_github_rate_limit_alert_window_hours:
        query.data?.monitoring_github_rate_limit_alert_window_hours ?? 24,
    });
    setErrorMessage("");
    setIsEditing(true);
  };

  const handleSave = async () => {
    setErrorMessage("");
    if (
      formValue.monitoring_failure_rate_threshold_percent < 1 ||
      formValue.monitoring_failure_rate_threshold_percent > 100 ||
      formValue.monitoring_failure_rate_min_runs < 1 ||
      formValue.monitoring_failure_rate_min_runs > 30 ||
      ![7, 30].includes(formValue.monitoring_failure_rate_window_days) ||
      formValue.monitoring_github_primary_limit_alert_threshold < 1 ||
      formValue.monitoring_github_primary_limit_alert_threshold > 100 ||
      formValue.monitoring_github_secondary_limit_alert_threshold < 1 ||
      formValue.monitoring_github_secondary_limit_alert_threshold > 100 ||
      formValue.monitoring_github_rate_limit_alert_window_hours < 1 ||
      formValue.monitoring_github_rate_limit_alert_window_hours > 168
    ) {
      setErrorMessage("실패율과 GitHub API 경고 기준의 입력 범위를 확인해주세요.");
      return;
    }
    try {
      await update.mutateAsync(formValue);
      onToast({
        tone: "success",
        message: "운영 로그인·화면 점검 설정 저장 완료",
        detail: formValue.monitoring_enabled
          ? `${formValue.monitoring_frequency === "daily" ? "매일" : "매주 일요일"} 예약 점검을 실행합니다.`
          : "예약 자동 점검을 중지했습니다. 수동 점검은 계속 실행할 수 있습니다.",
      });
      setIsEditing(false);
    } catch (error) {
      setErrorMessage(getSettingsModelErrorMessage(error, "운영 점검 설정 저장에 실패했습니다"));
    }
  };

  const handleRefreshHistory = async () => {
    if (
      isGithubApiRefreshBlocked(
        query.data?.monitoring_github_rate_limit_remaining,
        query.data?.monitoring_github_rate_limit_reset_at,
        query.data?.monitoring_github_secondary_limit_retry_at,
        query.data?.monitoring_github_refresh_reserve,
      )
    ) {
      onToast({
        tone: "warning",
        message: "원격 실행 이력 새로고침 잠금",
        detail: `GitHub API ${isGithubSecondaryBlocked ? "보조 제한" : "잔여량 보호"}으로 ${formatDateTime(githubRefreshRetryAt, timezone)} 이후 다시 시도해주세요.`,
      });
      return;
    }
    try {
      const refreshed = await refreshHistory.mutateAsync();
      if (refreshed.monitoring_history_error) {
        onToast({
          tone: "warning",
          message: "원격 실행 이력을 갱신하지 못했습니다",
          detail: refreshed.monitoring_history_error,
        });
        return;
      }
      onToast({
        tone: "success",
        message: "원격 실행 이력 새로고침 완료",
        detail: `최근 실행 ${refreshed.monitoring_recent_runs.length}건을 확인했습니다.`,
      });
    } catch (error) {
      onToast({
        tone: "error",
        message: "원격 실행 이력 새로고침 실패",
        detail: getSettingsModelErrorMessage(error, "GitHub 실행 이력을 확인하지 못했습니다"),
      });
    }
  };

  const handleManualRunOpen = () => {
    if (!canManage) return;
    if (
      isGithubApiRefreshBlocked(
        query.data?.monitoring_github_rate_limit_remaining,
        query.data?.monitoring_github_rate_limit_reset_at,
        query.data?.monitoring_github_secondary_limit_retry_at,
        query.data?.monitoring_github_refresh_reserve,
      )
    ) {
      onToast({
        tone: "warning",
        message: "자동 결과 확인을 시작하지 않았습니다",
        detail: `GitHub API ${isGithubSecondaryBlocked ? "보조 제한 재시도" : "초기화"} 시각 ${formatDateTime(githubRefreshRetryAt, timezone)} 이후 사용할 수 있습니다.`,
      });
      return;
    }
    if (manualRunTimerRef.current !== null) {
      window.clearTimeout(manualRunTimerRef.current);
    }
    const generation = manualRunGenerationRef.current + 1;
    manualRunGenerationRef.current = generation;
    const startedAt = Date.now();
    const knownRunUrls = (query.data?.monitoring_recent_runs ?? []).map((run) => run.run_url);
    setIsTrackingManualRun(true);

    const finish = () => {
      if (manualRunGenerationRef.current !== generation) return;
      manualRunGenerationRef.current += 1;
      if (manualRunTimerRef.current !== null) {
        window.clearTimeout(manualRunTimerRef.current);
      }
      manualRunTimerRef.current = null;
      setIsTrackingManualRun(false);
    };
    const poll = async () => {
      try {
        const refreshed = await refreshHistory.mutateAsync();
        if (manualRunGenerationRef.current !== generation) return;
        if (refreshed.monitoring_history_error) {
          finish();
          onToast({
            tone: "warning",
            message: "새 실행 결과 자동 확인 중지",
            detail: refreshed.monitoring_history_error,
          });
          return;
        }
        const newRun = findNewSmokeRun(refreshed.monitoring_recent_runs, knownRunUrls);
        if (newRun) {
          const trackedRun = getTrackedManualSmokeRun(newRun);
          if (trackedRun) {
            setLastManualRun(trackedRun);
            try {
              window.localStorage.setItem(
                LAST_MANUAL_SMOKE_RUN_STORAGE_KEY,
                JSON.stringify(trackedRun),
              );
            } catch {
              // The result still remains visible for the current page session.
            }
          }
          finish();
          onToast({
            tone: newRun.status === "success" ? "success" : newRun.status === "failure" ? "error" : "warning",
            message: `새 수동 점검 ${newRun.status === "success" ? "성공" : newRun.status === "failure" ? "실패" : "건너뜀"}`,
            detail: newRun.run_number ? `GitHub Actions #${newRun.run_number}` : "GitHub Actions 실행 결과를 확인했습니다.",
            link: { href: newRun.run_url, label: "GitHub 실행 보기" },
          });
          return;
        }
        if (Date.now() - startedAt >= MANUAL_RUN_TRACKING_TIMEOUT_MS) {
          finish();
          onToast({
            tone: "warning",
            message: "새 실행 결과를 아직 찾지 못했습니다",
            detail: "GitHub 실행 후 설정 화면의 지금 새로고침을 눌러 확인하세요.",
          });
          return;
        }
        manualRunTimerRef.current = window.setTimeout(poll, MANUAL_RUN_POLL_INTERVAL_MS);
      } catch (error) {
        if (manualRunGenerationRef.current !== generation) return;
        finish();
        onToast({
          tone: "error",
          message: "새 실행 결과 자동 확인 실패",
          detail: getSettingsModelErrorMessage(error, "GitHub 실행 이력을 확인하지 못했습니다"),
        });
      }
    };
    manualRunTimerRef.current = window.setTimeout(poll, MANUAL_RUN_POLL_INTERVAL_MS);
  };

  const handleClearManualRun = () => {
    try {
      window.localStorage.removeItem(LAST_MANUAL_SMOKE_RUN_STORAGE_KEY);
    } catch {
      // The result still remains hidden for the current page session.
    }
    setLastManualRun(null);
  };

  const handleTestStaleAlert = async () => {
    if (!window.confirm("저장된 Telegram 채널로 관리자 점검 지연 테스트 알림을 전송할까요?")) {
      return;
    }
    try {
      const result = await testStaleAlert.mutateAsync();
      onToast({
        tone: result.success ? "success" : "error",
        message: result.message,
        detail: result.detail,
      });
    } catch (error) {
      onToast({
        tone: "error",
        message: "관리자 지연 알림 dry-run 실패",
        detail: getSettingsModelErrorMessage(error, "Telegram 설정을 확인하지 못했습니다"),
      });
    }
  };

  const handleTestGithubRateLimitAlert = async () => {
    if (!window.confirm("현재 Manager 상태 운영 알림 경로로 GitHub API 반복 제한 테스트를 전송할까요?")) {
      return;
    }
    try {
      const result = await testGithubRateLimitAlert.mutateAsync();
      onToast({
        tone: result.success ? "success" : "error",
        message: result.message,
        detail: result.detail,
      });
    } catch (error) {
      onToast({
        tone: "error",
        message: "GitHub API 반복 제한 dry-run 실패",
        detail: getSettingsModelErrorMessage(error, "운영 알림 경로를 확인하지 못했습니다"),
      });
    }
  };

  return {
    canManage,
    isLoading: query.isLoading,
    isError: query.isError,
    isEditing,
    status: query.data,
    staleAlertHistory: testHistory.data?.smoke_admin_stale,
    timezone,
    formValue,
    errorMessage,
    isSaving: update.isPending,
    isRefreshingHistory: refreshHistory.isPending,
    isTrackingManualRun,
    lastManualRun,
    isTestingStaleAlert: testStaleAlert.isPending,
    isTestingGithubRateLimitAlert: testGithubRateLimitAlert.isPending,
    onEdit: handleEdit,
    onSave: handleSave,
    onRefreshHistory: handleRefreshHistory,
    onManualRunOpen: handleManualRunOpen,
    onClearManualRun: handleClearManualRun,
    onTestStaleAlert: handleTestStaleAlert,
    onTestGithubRateLimitAlert: handleTestGithubRateLimitAlert,
    onCancel: () => setIsEditing(false),
    onFormChange: setFormValue,
  };
}
