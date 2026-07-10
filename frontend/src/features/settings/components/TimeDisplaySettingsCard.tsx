import { Clock3 } from "lucide-react";

import type { TimeDisplaySettingsStatus } from "@/features/settings/api/settingsApi";
import { SettingsCardHeader } from "@/features/settings/components/SettingsCardPrimitives";

import { TimeDisplaySettingsEditForm } from "./TimeDisplaySettingsEditForm";
import { TimeDisplaySettingsSummary } from "./TimeDisplaySettingsSummary";

export function TimeDisplaySettingsCard({
  canManage,
  isLoading,
  isEditing,
  settings,
  formValue,
  errorMessage,
  isSaving,
  onEdit,
  onSave,
  onCancel,
  onFormValueChange,
}: {
  canManage: boolean;
  isLoading: boolean;
  isEditing: boolean;
  settings?: TimeDisplaySettingsStatus;
  formValue: string;
  errorMessage: string;
  isSaving: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onFormValueChange: (value: string) => void;
}) {
  return (
    <div className="card order-1 p-6">
      <SettingsCardHeader
        icon={<Clock3 className="h-5 w-5 text-emerald-600" />}
        title="시간 표시 설정"
        description="저장/토큰/감사로그 원본 시각은 UTC로 유지하고, 화면 표시만 선택한 IANA 타임존으로 변환합니다."
        canEdit={canManage && !isEditing && !isLoading}
        onEdit={onEdit}
      />

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-slate-800" />
      ) : isEditing ? (
        <TimeDisplaySettingsEditForm
          errorMessage={errorMessage}
          formValue={formValue}
          isSaving={isSaving}
          onCancel={onCancel}
          onFormValueChange={onFormValueChange}
          onSave={onSave}
          settings={settings}
        />
      ) : (
        <TimeDisplaySettingsSummary settings={settings} />
      )}
    </div>
  );
}
