import { Bug } from "lucide-react";

import type {
  CertificateDiagnosticsSettingsInput,
  CertificateDiagnosticsSettingsStatus,
} from "@/features/settings/api/settingsApi";
import { SettingsCardHeader } from "@/features/settings/components/SettingsCardPrimitives";
import { CertificateDiagnosticsSettingsEditForm } from "./CertificateDiagnosticsSettingsEditForm";
import { CertificateDiagnosticsSettingsSummary } from "./CertificateDiagnosticsSettingsSummary";

interface CertificateDiagnosticsSettingsCardProps {
  canManage: boolean;
  isLoading: boolean;
  isEditing: boolean;
  settings?: CertificateDiagnosticsSettingsStatus;
  formValue: CertificateDiagnosticsSettingsInput;
  isSaving: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onFormChange: (value: CertificateDiagnosticsSettingsInput) => void;
}

export function CertificateDiagnosticsSettingsCard({
  canManage,
  isLoading,
  isEditing,
  settings,
  formValue,
  isSaving,
  onEdit,
  onSave,
  onCancel,
  onFormChange,
}: CertificateDiagnosticsSettingsCardProps) {
  return (
    <div className="card p-6 order-2">
      <SettingsCardHeader
        icon={<Bug className="w-5 h-5 text-violet-600" />}
        title="인증서 진단"
        description="사전 진단 자동 재검사 주기와 반복 실패 감지 기준을 조정합니다. 설정값은 수동 진단, 자동 재검사, 반복 실패 알림에 공통 적용됩니다."
        canEdit={canManage && !isEditing && !isLoading}
        onEdit={onEdit}
      />

      {isLoading ? (
        <div className="h-24 bg-gray-100 rounded-lg animate-pulse" />
      ) : isEditing ? (
        <CertificateDiagnosticsSettingsEditForm
          formValue={formValue}
          isSaving={isSaving}
          onCancel={onCancel}
          onFormChange={onFormChange}
          onSave={onSave}
        />
      ) : (
        <CertificateDiagnosticsSettingsSummary settings={settings} />
      )}
    </div>
  );
}
