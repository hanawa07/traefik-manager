import { TimerReset } from "lucide-react";

import type { DeploymentBottleneckSettings } from "@/features/settings/api/settingsApi";
import type { DeploymentBottleneckPreview as DeploymentBottleneckPreviewValue } from "@/features/deployment/lib/deploymentBottleneckPreview";
import {
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
  isEditing: boolean;
  isLoading: boolean;
  isPreviewError: boolean;
  isPreviewLoading: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onEdit: () => void;
  onFormChange: (value: DeploymentBottleneckSettings) => void;
  onSave: () => void;
  preview?: DeploymentBottleneckPreviewValue;
  settings?: DeploymentBottleneckSettings;
}

export function DeploymentBottleneckSettingsCard({
  canManage,
  formValue,
  isEditing,
  isLoading,
  isPreviewError,
  isPreviewLoading,
  isSaving,
  onCancel,
  onEdit,
  onFormChange,
  onSave,
  preview,
  settings,
}: DeploymentBottleneckSettingsCardProps) {
  return (
    <div className="card order-2 p-6">
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
          </div>
          <DeploymentBottleneckPreview
            isError={isPreviewError}
            isLoading={isPreviewLoading}
            preview={preview}
            requiredCount={formValue.consecutive_count}
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
          <DeploymentBottleneckPreview
            isError={isPreviewError}
            isLoading={isPreviewLoading}
            preview={preview}
            requiredCount={settings?.consecutive_count ?? 3}
          />
          <p className="pt-1 text-xs text-gray-500 dark:text-slate-400">
            정상 또는 실패 배포가 기록되면 연속 병목 상태가 초기화됩니다.
          </p>
        </SettingsSummary>
      )}
    </div>
  );
}
