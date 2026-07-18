import { DatabaseZap, TimerReset } from "lucide-react";

import {
  MANAGER_DEPLOYMENT_BOTTLENECK_EVENT_LIMIT,
  MANAGER_DEPLOYMENT_BOTTLENECK_EVENT_WARNING_COUNT,
} from "@/features/deployment/api/deploymentApi";
import type { DeploymentBottleneckSettings } from "@/features/settings/api/settingsApi";
import type { DeploymentBottleneckPreview as DeploymentBottleneckPreviewValue } from "@/features/deployment/lib/deploymentBottleneckPreview";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import {
  SettingsActionRow,
  SettingsCardHeader,
  SettingsSummary,
  SettingsSummaryRow,
} from "./SettingsCardPrimitives";
import { CertificateDiagnosticsSettingsActions } from "./CertificateDiagnosticsSettingsActions";
import { CertificateDiagnosticsSettingsNumberField } from "./CertificateDiagnosticsSettingsNumberField";
import { DeploymentBottleneckPreview } from "./DeploymentBottleneckPreview";

interface DeploymentBottleneckSettingsCardProps {
  canManage: boolean;
  formValue: DeploymentBottleneckSettings;
  hostPreview?: DeploymentBottleneckPreviewValue;
  hostOverrideLabels: string[];
  hostSettings?: DeploymentBottleneckSettings;
  isEditing: boolean;
  isCleaning: boolean;
  isLoading: boolean;
  isPreviewError: boolean;
  isPreviewLoading: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onCleanup: () => void;
  onEdit: () => void;
  onFormChange: (value: DeploymentBottleneckSettings) => void;
  onSave: () => void;
  preview?: DeploymentBottleneckPreviewValue;
  settings?: DeploymentBottleneckSettings;
  retainedEventCount?: number;
  oldestEventAt?: string | null;
  newestEventAt?: string | null;
  timezone?: string;
}

export function DeploymentBottleneckSettingsCard({
  canManage,
  formValue,
  hostPreview,
  hostOverrideLabels,
  hostSettings,
  isEditing,
  isCleaning,
  isLoading,
  isPreviewError,
  isPreviewLoading,
  isSaving,
  onCancel,
  onCleanup,
  onEdit,
  onFormChange,
  onSave,
  preview,
  settings,
  retainedEventCount,
  oldestEventAt,
  newestEventAt,
  timezone,
}: DeploymentBottleneckSettingsCardProps) {
  const storageRange = retainedEventCount === undefined
    ? "확인 중"
    : retainedEventCount === 0
      ? "없음"
      : `${formatDateTime(oldestEventAt, timezone)} ~ ${formatDateTime(newestEventAt, timezone)}`;

  return (
    <div className="card order-2 p-6" data-testid="deployment-bottleneck-settings-card">
      <SettingsCardHeader
        icon={<TimerReset className="h-5 w-5 text-orange-600" />}
        title="배포 병목 운영 알림"
        description="성공한 blue-green 배포에서 한 단계가 오래 걸리는 상태가 연속될 때 운영 알림을 요청합니다."
        canEdit={canManage && !isEditing && !isLoading}
        onEdit={onEdit}
      />

      {isLoading ? (
        <div className="h-20 animate-pulse rounded-lg bg-gray-100 dark:bg-slate-800" />
      ) : isEditing ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <CertificateDiagnosticsSettingsNumberField
              help="단일 배포 단계가 이 시간을 초과하면 병목 1회로 계산합니다."
              label="단계 소요 기준 (초)"
              max={900}
              min={1}
              onChange={(value) => onFormChange({ ...formValue, threshold_ms: value * 1000 })}
              value={formValue.threshold_ms / 1000}
            />
            <CertificateDiagnosticsSettingsNumberField
              help="이 횟수만큼 연속된 경우 한 번만 운영 알림을 요청합니다."
              label="연속 감지 기준 (회)"
              max={20}
              min={1}
              onChange={(value) => onFormChange({ ...formValue, consecutive_count: value })}
              value={formValue.consecutive_count}
            />
            <CertificateDiagnosticsSettingsNumberField
              help={`기간이 지난 이벤트는 다음 배포 검사에서 삭제합니다. 최대 ${MANAGER_DEPLOYMENT_BOTTLENECK_EVENT_LIMIT}건 제한도 함께 적용됩니다.`}
              label="이벤트 보관 기간 (일)"
              max={3650}
              min={1}
              onChange={(value) => onFormChange({ ...formValue, event_retention_days: value })}
              value={formValue.event_retention_days}
            />
          </div>
          <DeploymentBottleneckPreview
            eventRetentionDays={formValue.event_retention_days}
            hostPreview={hostPreview}
            hostOverrideLabels={hostOverrideLabels}
            hostSettings={hostSettings}
            isError={isPreviewError}
            isLoading={isPreviewLoading}
            preview={preview}
            requiredCount={formValue.consecutive_count}
            thresholdMs={formValue.threshold_ms}
          />
          <p className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
            저장한 값은 다음 배포 검사부터 적용됩니다. 호스트 환경 변수로 지정한 값이 있으면 환경 변수가 우선합니다.
          </p>
          <CertificateDiagnosticsSettingsActions
            isSaving={isSaving}
            onCancel={onCancel}
            onSave={onSave}
          />
        </div>
      ) : (
        <SettingsSummary>
          <SettingsSummaryRow label="단계 소요 기준" value={`${(settings?.threshold_ms ?? 60_000) / 1000}초 초과`} />
          <SettingsSummaryRow label="연속 감지 기준" value={`${settings?.consecutive_count ?? 3}회`} />
          <SettingsSummaryRow label="이벤트 보관 기간" value={`${settings?.event_retention_days ?? 90}일 · 최대 ${MANAGER_DEPLOYMENT_BOTTLENECK_EVENT_LIMIT}건`} />
          <SettingsSummaryRow
            label="현재 보관"
            value={retainedEventCount === undefined ? "확인 중" : `${retainedEventCount}/${MANAGER_DEPLOYMENT_BOTTLENECK_EVENT_LIMIT}건`}
          />
          <SettingsSummaryRow label="보관 범위" value={storageRange} />
          {retainedEventCount !== undefined &&
          retainedEventCount >= MANAGER_DEPLOYMENT_BOTTLENECK_EVENT_WARNING_COUNT ? (
            <p
              className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100"
              data-deployment-bottleneck-storage-warning
            >
              보관 한도에 가까움 · 현재 {retainedEventCount}/{MANAGER_DEPLOYMENT_BOTTLENECK_EVENT_LIMIT}건입니다. {canManage ? "보관 기간을 줄이거나 지금 정리하세요." : "관리자에게 정리를 요청하세요."}
            </p>
          ) : null}
          <DeploymentBottleneckPreview
            eventRetentionDays={settings?.event_retention_days ?? 90}
            hostPreview={hostPreview}
            hostOverrideLabels={hostOverrideLabels}
            hostSettings={hostSettings}
            isError={isPreviewError}
            isLoading={isPreviewLoading}
            preview={preview}
            requiredCount={settings?.consecutive_count ?? 3}
            thresholdMs={settings?.threshold_ms ?? 60_000}
          />
          <p className="pt-1 text-xs text-gray-500 dark:text-slate-400">
            정상 또는 실패 배포가 기록되면 연속 병목 상태가 초기화됩니다.
          </p>
          {canManage ? (
            <SettingsActionRow>
              <button
                className="btn-secondary flex items-center gap-2"
                data-deployment-bottleneck-cleanup
                disabled={isCleaning}
                onClick={onCleanup}
                type="button"
              >
                <DatabaseZap className="h-4 w-4" />
                {isCleaning ? "정리 중" : "지금 정리"}
              </button>
            </SettingsActionRow>
          ) : null}
        </SettingsSummary>
      )}
    </div>
  );
}
