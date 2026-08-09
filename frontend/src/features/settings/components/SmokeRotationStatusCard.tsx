import { MonitorCheck } from "lucide-react";

import type {
  SmokeMonitoringSettingsInput,
  SmokeRotationStatus,
  SettingsTestHistoryItem,
} from "@/features/settings/api/settingsApi";
import {
  SettingsCardHeader,
  SettingsSummary,
} from "@/features/settings/components/SettingsCardPrimitives";
import type { TrackedManualSmokeRun } from "@/features/settings/lib/smokeManualRunTracking";
import { SmokeMonitoringSettingsEditForm } from "./SmokeMonitoringSettingsEditForm";
import { SmokeMonitoringStatusSummary } from "./SmokeMonitoringStatusSummary";

interface SmokeRotationStatusCardProps {
  canManage: boolean;
  isLoading: boolean;
  isError: boolean;
  isEditing: boolean;
  status?: SmokeRotationStatus;
  staleAlertHistory?: SettingsTestHistoryItem;
  failureTypeIncreaseAlertHistory?: SettingsTestHistoryItem;
  githubRateLimitAlertHistory?: SettingsTestHistoryItem;
  githubPrimaryRateLimitDeliveryHistory?: SettingsTestHistoryItem;
  githubSecondaryRateLimitDeliveryHistory?: SettingsTestHistoryItem;
  githubPrimaryRateLimitLastTriggeredAt?: string | null;
  githubSecondaryRateLimitLastTriggeredAt?: string | null;
  timezone?: string;
  formValue: SmokeMonitoringSettingsInput;
  errorMessage: string;
  isSaving: boolean;
  isRefreshingHistory: boolean;
  isTrackingManualRun: boolean;
  lastManualRun: TrackedManualSmokeRun | null;
  isTestingStaleAlert: boolean;
  isTestingGithubRateLimitAlert: boolean;
  isTestingFailureTypeIncreaseAlert: boolean;
  onEdit: () => void;
  onSave: () => void;
  onRefreshHistory: () => void;
  onManualRunOpen: () => void;
  onClearManualRun: () => void;
  onTestStaleAlert: () => void;
  onTestGithubRateLimitAlert: () => void;
  onTestFailureTypeIncreaseAlert: () => void;
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
  failureTypeIncreaseAlertHistory,
  githubRateLimitAlertHistory,
  githubPrimaryRateLimitDeliveryHistory,
  githubSecondaryRateLimitDeliveryHistory,
  githubPrimaryRateLimitLastTriggeredAt,
  githubSecondaryRateLimitLastTriggeredAt,
  timezone,
  formValue,
  errorMessage,
  isSaving,
  isRefreshingHistory,
  isTrackingManualRun,
  lastManualRun,
  isTestingStaleAlert,
  isTestingGithubRateLimitAlert,
  isTestingFailureTypeIncreaseAlert,
  onEdit,
  onSave,
  onRefreshHistory,
  onManualRunOpen,
  onClearManualRun,
  onTestStaleAlert,
  onTestGithubRateLimitAlert,
  onTestFailureTypeIncreaseAlert,
  onCancel,
  onFormChange,
}: SmokeRotationStatusCardProps) {
  const scheduleTime = status?.monitoring_schedule_time ?? "03:17";
  const scheduleTimezone = status?.monitoring_schedule_timezone ?? "Asia/Seoul";

  return (
    <div className="card p-6" data-testid="smoke-rotation-status-card">
      <SettingsCardHeader
        icon={<MonitorCheck className="h-5 w-5 text-cyan-600" />}
        title="운영 로그인·화면 점검"
        description="정상 사용자 로그인과 주요 화면 로딩을 확인하는 운영 점검입니다. 공격 탐지나 취약점 검사는 로그인 보안 방어와 별개입니다."
        canEdit={
          canManage &&
          status?.monitoring_mode === "remote" &&
          !isEditing &&
          !isLoading
        }
        onEdit={onEdit}
      />

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-slate-800" />
      ) : isError || !status ? (
        <p className="text-sm text-rose-600 dark:text-rose-300">
          운영 점검 상태를 불러오지 못했습니다.
        </p>
      ) : isEditing && status.monitoring_mode === "remote" ? (
        <SmokeMonitoringSettingsEditForm
          formValue={formValue}
          scheduleTime={scheduleTime}
          scheduleTimezone={scheduleTimezone}
          errorMessage={errorMessage}
          failureMetadataCount={status.monitoring_failure_metadata_count}
          isSaving={isSaving}
          onSave={onSave}
          onCancel={onCancel}
          onFormChange={onFormChange}
        />
      ) : (
        <SettingsSummary>
          <SmokeMonitoringStatusSummary
            canManage={canManage}
            status={status}
            staleAlertHistory={staleAlertHistory}
            failureTypeIncreaseAlertHistory={failureTypeIncreaseAlertHistory}
            githubRateLimitAlertHistory={githubRateLimitAlertHistory}
            githubPrimaryRateLimitDeliveryHistory={
              githubPrimaryRateLimitDeliveryHistory
            }
            githubSecondaryRateLimitDeliveryHistory={
              githubSecondaryRateLimitDeliveryHistory
            }
            githubPrimaryRateLimitLastTriggeredAt={
              githubPrimaryRateLimitLastTriggeredAt
            }
            githubSecondaryRateLimitLastTriggeredAt={
              githubSecondaryRateLimitLastTriggeredAt
            }
            timezone={timezone}
            isRefreshingHistory={isRefreshingHistory}
            isTrackingManualRun={isTrackingManualRun}
            lastManualRun={lastManualRun}
            isTestingStaleAlert={isTestingStaleAlert}
            isTestingGithubRateLimitAlert={isTestingGithubRateLimitAlert}
            isTestingFailureTypeIncreaseAlert={isTestingFailureTypeIncreaseAlert}
            onRefreshHistory={onRefreshHistory}
            onManualRunOpen={onManualRunOpen}
            onClearManualRun={onClearManualRun}
            onTestStaleAlert={onTestStaleAlert}
            onTestGithubRateLimitAlert={onTestGithubRateLimitAlert}
            onTestFailureTypeIncreaseAlert={onTestFailureTypeIncreaseAlert}
          />
        </SettingsSummary>
      )}
    </div>
  );
}
