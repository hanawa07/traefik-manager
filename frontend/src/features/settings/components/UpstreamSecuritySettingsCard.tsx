import { ShieldCheck } from "lucide-react";

import type { UpstreamSecuritySettingsStatus } from "@/features/settings/api/settingsApi";
import {
  SettingsCardHeader,
} from "@/features/settings/components/SettingsCardPrimitives";
import type { UpstreamSecurityForm } from "@/features/settings/lib/settingsDefaults";
import { UpstreamSecuritySettingsEditForm } from "@/features/settings/components/UpstreamSecuritySettingsEditForm";
import { UpstreamSecuritySettingsSummary } from "@/features/settings/components/UpstreamSecuritySettingsSummary";

interface UpstreamSecuritySettingsCardProps {
  canManage: boolean;
  isLoading: boolean;
  isEditing: boolean;
  settings?: UpstreamSecuritySettingsStatus;
  formValue: UpstreamSecurityForm;
  isSaving: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onFormChange: (value: UpstreamSecurityForm) => void;
}

export function UpstreamSecuritySettingsCard({
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
}: UpstreamSecuritySettingsCardProps) {
  return (
    <div className="card p-6 order-3">
      <SettingsCardHeader
        icon={<ShieldCheck className="w-5 h-5 text-rose-600" />}
        title="업스트림 보안"
        description={
          "DNS strict mode와 allowlist를 조합해 업스트림 저장 정책을 명시적으로 제한합니다. " +
          "외부 FQDN은 suffix 기준으로, 내부 서비스명과 사설 IP는 별도 옵션으로 제어합니다."
        }
        canEdit={canManage && !isEditing && !isLoading}
        onEdit={onEdit}
      />

      {isLoading ? (
        <div className="h-24 bg-gray-100 rounded-lg animate-pulse" />
      ) : isEditing ? (
        <UpstreamSecuritySettingsEditForm
          settings={settings}
          formValue={formValue}
          isSaving={isSaving}
          onSave={onSave}
          onCancel={onCancel}
          onFormChange={onFormChange}
        />
      ) : (
        <UpstreamSecuritySettingsSummary settings={settings} />
      )}
    </div>
  );
}
